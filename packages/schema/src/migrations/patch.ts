/**
 * Per-block patches addressed by `_uid` instead of by position in the story
 * tree, so an inverse still lands after unrelated blocks were added, removed,
 * or reordered around the one it targets.
 */

export type AnyBlock = Record<string, unknown> & { _uid: string; component: string };

export type BlockPatchOp =
  /** Whole-value replacement of one field. `expect` is the value the migration left behind. */
  | { kind: "set"; key: string; value: unknown; expect?: unknown }
  /** Field removed entirely. */
  | { kind: "unset"; key: string; expect?: unknown }
  /**
   * One child block put into a `bloks` array. `after` is the uid of the sibling
   * it follows in the target list, `null` when it comes first; `index` is the
   * fallback when that sibling is gone.
   */
  | {
      kind: "listInsert";
      key: string;
      uid: string;
      index: number;
      after: string | null;
      block: AnyBlock;
    }
  /** One child block taken out of a `bloks` array. `expect` is the whole subtree the migration left behind. */
  | { kind: "listRemove"; key: string; uid: string; expect: AnyBlock }
  /**
   * Order of the surviving children of a `bloks` array, by uid. Carries only
   * uids, so replaying it cannot overwrite a concurrent edit to a child's own
   * fields.
   */
  | { kind: "listOrder"; key: string; uids: string[]; expect: string[] };

export interface BlockPatch {
  uid: string;
  component: string;
  ops: BlockPatchOp[];
}

/**
 * Keys no op writes, so the differ never reports them as a change. `_uid`
 * addresses the block itself and no op rewrites it; `_editable` is injected by
 * the delivery API for the Visual Editor and never stored, so it only appears
 * when content reaches the differ from a draft render rather than from the
 * Management API. `component` is diffed like any other key because
 * `renameBlock` rewrites it.
 */
const TRANSPORT_KEYS = new Set(["_uid", "_editable"]);

/**
 * Field-level translation stores each non-default language beside the field it
 * translates, in the same block: `author` holds the default language and
 * `author__i18n__de` holds German. The language code is written with `-`
 * replaced by `_`, so `en-US` becomes `author__i18n__en_US`.
 *
 * These are ordinary content keys. An op that moves or drops `author` without
 * moving or dropping its translations leaves them addressed to a field name
 * that no longer exists, and the delivery API drops a translation whose base
 * field is no longer declared translatable — silent, unrecoverable data loss.
 */
export const TRANSLATION_SEPARATOR = "__i18n__";

/** Every `<field>__i18n__<lang>` key a block holds for one field. */
export function translationKeysFor(block: AnyBlock, field: string): string[] {
  const prefix = `${field}${TRANSLATION_SEPARATOR}`;
  return Object.keys(block).filter((key) => key.startsWith(prefix));
}

/**
 * The language a `<field>__i18n__<lang>` key carries, or `undefined` for a base
 * key. The stored code writes `-` as `_`, so `author__i18n__en_US` is `en-US`.
 */
export function languageOfKey(key: string): string | undefined {
  const at = key.indexOf(TRANSLATION_SEPARATOR);
  if (at === -1) return undefined;
  return key.slice(at + TRANSLATION_SEPARATOR.length).replace(/_/g, "-");
}

/** The base field name a key translates, or the key itself when it is not one. */
export function baseFieldOf(key: string): string {
  const at = key.indexOf(TRANSLATION_SEPARATOR);
  return at === -1 ? key : key.slice(0, at);
}

export function isBlock(value: unknown): value is AnyBlock {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)._uid === "string" &&
    typeof (value as Record<string, unknown>).component === "string"
  );
}

function isBlockList(value: unknown): value is AnyBlock[] {
  return Array.isArray(value) && value.every(isBlock);
}

/** Deep structural equality over JSON-ish values. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a !== "object") return false;
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const key of keys) {
    if (!deepEqual(ao[key], bo[key])) return false;
  }
  return true;
}

/**
 * The part of a block a patch may own: descendant blocks collapse to `_uid`
 * markers so a child's own edits are not duplicated into its parent's patch.
 */
function ownView(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ownView);
  if (isBlock(value)) return { __blockRef: value._uid };
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, ownView(v)]));
  }
  return value;
}

/**
 * Block identity the whole patch scheme rests on: a `_uid` must be unique
 * within a story and must be present. Saving a story regenerates the `_uid` of
 * the second block that repeats one, and generates a `_uid` for a block that
 * has none. In both cases the recorded patches would address a block that does
 * not exist remotely, and an undo would silently do nothing.
 */
export function findUnstableUids(content: unknown): { duplicate: string[]; missing: number } {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  let missing = 0;
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const record = node as Record<string, unknown>;
    if (typeof record.component === "string") {
      if (typeof record._uid !== "string" || record._uid === "") {
        missing++;
      } else if (seen.has(record._uid)) {
        duplicate.add(record._uid);
      } else {
        seen.add(record._uid);
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(content);
  return { duplicate: [...duplicate], missing };
}

/** Indexes every block in a content tree by `_uid`, at any depth. */
export function indexBlocks(
  content: unknown,
  into = new Map<string, AnyBlock>(),
): Map<string, AnyBlock> {
  if (Array.isArray(content)) {
    for (const item of content) indexBlocks(item, into);
    return into;
  }
  if (typeof content === "object" && content !== null) {
    if (isBlock(content)) into.set(content._uid, content);
    for (const value of Object.values(content)) indexBlocks(value, into);
  }
  return into;
}

/**
 * Diff one block instance against itself before/after a transform.
 * Directional: the inverse of `diffBlock(before, after)` is
 * `diffBlock(after, before)` — no separate inversion algebra is needed.
 */
export function diffBlock(before: AnyBlock, after: AnyBlock): BlockPatch | null {
  const ops: BlockPatchOp[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (TRANSPORT_KEYS.has(key)) continue;
    const hadKey = key in before;
    const hasKey = key in after;
    const beforeValue = before[key];
    const afterValue = after[key];

    if (hadKey && !hasKey) {
      ops.push({ kind: "unset", key, expect: beforeValue });
      continue;
    }
    if (!hadKey && hasKey) {
      ops.push({ kind: "set", key, value: afterValue, expect: undefined });
      continue;
    }

    const beforeOwn = ownView(beforeValue);
    const afterOwn = ownView(afterValue);
    if (deepEqual(beforeOwn, afterOwn)) continue;

    // Both sides must be block lists: a value that turns into a list, or back,
    // is replaced whole so the inverse can restore the value it displaced.
    if (isBlockList(beforeValue) && isBlockList(afterValue)) {
      const beforeUids = beforeValue.map((b) => b._uid);
      const afterUids = afterValue.map((b) => b._uid);
      afterValue.forEach((block, index) => {
        if (!beforeUids.includes(block._uid)) {
          const after = index === 0 ? null : afterValue[index - 1]._uid;
          ops.push({ kind: "listInsert", key, uid: block._uid, index, after, block });
        }
      });
      for (const block of beforeValue) {
        if (!afterUids.includes(block._uid)) {
          ops.push({ kind: "listRemove", key, uid: block._uid, expect: block });
        }
      }
      const survivorsBefore = beforeUids.filter((uid) => afterUids.includes(uid));
      const survivorsAfter = afterUids.filter((uid) => beforeUids.includes(uid));
      if (!deepEqual(survivorsBefore, survivorsAfter)) {
        ops.push({ kind: "listOrder", key, uids: survivorsAfter, expect: survivorsBefore });
      }
      continue;
    }

    ops.push({ kind: "set", key, value: afterValue, expect: beforeValue });
  }

  if (ops.length === 0) return null;
  return { uid: before._uid, component: before.component, ops };
}

export interface ApplyConflict {
  uid: string;
  key: string;
  reason: string;
}

export interface ApplyResult {
  applied: number;
  conflicts: ApplyConflict[];
  missing: string[];
}

function listOf(block: AnyBlock, key: string): unknown[] {
  return Array.isArray(block[key]) ? (block[key] as unknown[]) : [];
}

function findChild(block: AnyBlock, key: string, uid: string): AnyBlock | undefined {
  return listOf(block, key).find((item): item is AnyBlock => isBlock(item) && item._uid === uid);
}

function liveOrder(block: AnyBlock, key: string, known: readonly string[]): string[] {
  return listOf(block, key)
    .filter(isBlock)
    .map((item) => item._uid)
    .filter((uid) => known.includes(uid));
}

/** Whether the live block already holds what the op would write. */
function isSettled(block: AnyBlock, op: BlockPatchOp): boolean {
  switch (op.kind) {
    case "set":
      return op.key in block && deepEqual(block[op.key], op.value);
    case "unset":
      return !(op.key in block);
    case "listInsert": {
      const child = findChild(block, op.key, op.uid);
      return child !== undefined && deepEqual(child, op.block);
    }
    case "listRemove":
      return findChild(block, op.key, op.uid) === undefined;
    case "listOrder":
      return deepEqual(liveOrder(block, op.key, op.uids), op.uids);
  }
}

/**
 * Reports every op of a block patch whose live value no longer matches what the
 * migration left behind. Values are compared whole, nested blocks included: an
 * op that replaces a value replaces every block inside it too, so an edit to
 * any of them is an edit the op would discard.
 */
function conflictsOf(block: AnyBlock, patch: BlockPatch): ApplyConflict[] {
  const conflicts: ApplyConflict[] = [];
  const conflict = (key: string, reason: string) => conflicts.push({ uid: patch.uid, key, reason });
  for (const op of patch.ops) {
    switch (op.kind) {
      case "set":
      case "unset":
        if (!deepEqual(block[op.key], op.expect)) {
          conflict(op.key, "live value differs from the value the migration wrote");
        }
        break;
      case "listRemove": {
        const child = findChild(block, op.key, op.uid);
        if (child === undefined) {
          conflict(op.key, `block ${op.uid} is no longer in "${op.key}"`);
        } else if (!deepEqual(child, op.expect)) {
          conflict(op.key, `block ${op.uid} in "${op.key}" changed since the migration wrote it`);
        }
        break;
      }
      case "listOrder":
        if (!deepEqual(liveOrder(block, op.key, op.expect), op.expect)) {
          conflict(op.key, `live order of "${op.key}" differs from the order the migration wrote`);
        }
        break;
      case "listInsert":
        // Checked across all patches at once; see `collisionOf`.
        break;
    }
  }
  return conflicts;
}

/** Every block uid in a value, at any depth, repeats included. */
function uidsIn(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) uidsIn(item, into);
  } else if (typeof value === "object" && value !== null) {
    if (isBlock(value)) into.push(value._uid);
    for (const nested of Object.values(value)) uidsIn(nested, into);
  }
  return into;
}

/** The live values a patch would drop: whatever a `set`, `unset` or `listRemove` replaces. */
function displacedBy(block: AnyBlock, patch: BlockPatch): unknown[] {
  return patch.ops.flatMap((op) => {
    if (op.kind === "set" || op.kind === "unset") return [block[op.key]];
    if (op.kind === "listRemove") return [findChild(block, op.key, op.uid)];
    return [];
  });
}

/** The values a patch would put in: whatever a `set` or `listInsert` writes. */
function insertedBy(patch: BlockPatch): { key: string; value: unknown }[] {
  return patch.ops.flatMap((op) => {
    if (op.kind === "set") return [{ key: op.key, value: op.value }];
    if (op.kind === "listInsert") return [{ key: op.key, value: op.block }];
    return [];
  });
}

type PendingPatch = { patch: BlockPatch; block: AnyBlock };

/**
 * The first patch that would write a block whose uid the story still holds
 * after every other applicable patch ran. Restoring a block an editor moved
 * elsewhere would leave the story with two blocks of one uid, which saving
 * renumbers.
 */
function collisionOf(
  content: unknown,
  pending: readonly PendingPatch[],
): { patch: BlockPatch; key: string; uid: string } | undefined {
  const remaining = new Map<string, number>();
  for (const uid of uidsIn(content)) remaining.set(uid, (remaining.get(uid) ?? 0) + 1);
  for (const { patch, block } of pending) {
    for (const uid of uidsIn(displacedBy(block, patch))) {
      remaining.set(uid, (remaining.get(uid) ?? 0) - 1);
    }
  }
  for (const { patch } of pending) {
    for (const { key, value } of insertedBy(patch)) {
      const uid = uidsIn(value).find((inserted) => (remaining.get(inserted) ?? 0) > 0);
      if (uid !== undefined) return { patch, key, uid };
    }
  }
  return undefined;
}

/** Removals first and inserts in target order, so each insert finds the sibling it follows. */
const OP_ORDER: Record<BlockPatchOp["kind"], number> = {
  listRemove: 0,
  listInsert: 1,
  listOrder: 2,
  set: 3,
  unset: 3,
};

function applyOrder(a: BlockPatchOp, b: BlockPatchOp): number {
  const byKind = OP_ORDER[a.kind] - OP_ORDER[b.kind];
  if (byKind !== 0) return byKind;
  return a.kind === "listInsert" && b.kind === "listInsert" ? a.index - b.index : 0;
}

function applyOp(block: AnyBlock, op: BlockPatchOp): boolean {
  switch (op.kind) {
    case "set":
      block[op.key] = structuredClone(op.value);
      return true;
    case "unset":
      delete block[op.key];
      return true;
    case "listInsert": {
      const list = listOf(block, op.key);
      if (findChild(block, op.key, op.uid)) return false;
      const sibling =
        op.after === null ? -1 : list.findIndex((item) => isBlock(item) && item._uid === op.after);
      const at =
        op.after === null ? 0 : sibling === -1 ? Math.min(op.index, list.length) : sibling + 1;
      list.splice(at, 0, structuredClone(op.block));
      block[op.key] = list;
      return true;
    }
    case "listOrder": {
      const list = listOf(block, op.key);
      const rank = new Map(op.uids.map((uid, index) => [uid, index]));
      // Children the patch does not know about keep their live slot; the
      // known ones are re-dealt into the slots they already occupied.
      const slots: number[] = [];
      list.forEach((item, index) => {
        if (isBlock(item) && rank.has(item._uid)) slots.push(index);
      });
      const ordered = op.uids
        .map((uid) => findChild(block, op.key, uid))
        .filter((item): item is AnyBlock => item !== undefined);
      slots.forEach((slot, index) => {
        list[slot] = ordered[index]!;
      });
      block[op.key] = list;
      return true;
    }
    case "listRemove": {
      const list = listOf(block, op.key);
      const at = list.findIndex((item) => isBlock(item) && item._uid === op.uid);
      if (at === -1) return false;
      list.splice(at, 1);
      return true;
    }
  }
}

/**
 * Replays patches against live content. A block whose live content no longer
 * matches what the migration left behind is reported as a conflict and skipped
 * whole, so an edit made after the migration is never clobbered.
 *
 * The unit of conflict is the block, not the op: a rename shows up in the diff
 * as an `unset` of the old key plus a `set` of the new one, and applying half of
 * that pair would leave the block holding both names at once — content no
 * schema describes and no editor could have produced.
 *
 * A patch the live block already satisfies is skipped without a conflict, so
 * replaying the same patches twice is a no-op. `force` overwrites conflicting
 * blocks, but never restores a block whose uid the story holds elsewhere.
 */
export function applyPatches(
  content: unknown,
  patches: BlockPatch[],
  options: { force?: boolean } = {},
): ApplyResult {
  const index = indexBlocks(content);
  const result: ApplyResult = { applied: 0, conflicts: [], missing: [] };

  const pending: PendingPatch[] = [];
  for (const patch of patches) {
    const block = index.get(patch.uid);
    if (!block) {
      result.missing.push(patch.uid);
    } else if (!patch.ops.every((op) => isSettled(block, op))) {
      pending.push({ patch, block });
    }
  }

  // Every check runs against the content as it stands, before any patch lands.
  const blocked = new Map<BlockPatch, ApplyConflict[]>();
  if (!options.force) {
    for (const { patch, block } of pending) {
      const conflicts = conflictsOf(block, patch);
      if (conflicts.length > 0) blocked.set(patch, conflicts);
    }
  }
  for (;;) {
    const collision = collisionOf(
      content,
      pending.filter(({ patch }) => !blocked.has(patch)),
    );
    if (!collision) break;
    blocked.set(collision.patch, [
      {
        uid: collision.patch.uid,
        key: collision.key,
        reason: `block ${collision.uid} now sits elsewhere in the story, and restoring it would repeat its uid`,
      },
    ]);
  }

  for (const { patch, block } of pending) {
    const conflicts = blocked.get(patch);
    if (conflicts) {
      result.conflicts.push(...conflicts);
      continue;
    }
    for (const op of [...patch.ops].sort(applyOrder)) {
      if (applyOp(block, op)) result.applied++;
    }
  }

  return result;
}
