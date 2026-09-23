/**
 * Not exported from the package root. Whether content migrations belong in
 * `@storyblok/schema` at all is open — see the prototype design doc; the
 * subpath export exists so this can move without breaking a consumer's import.
 *
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
  /** One child block put back into (or taken out of) a `bloks` array, by uid. */
  | { kind: "listInsert"; key: string; uid: string; index: number; block: AnyBlock }
  | { kind: "listRemove"; key: string; uid: string }
  /**
   * Order of the surviving children of a `bloks` array, by uid. Carries only
   * uids, so replaying it cannot clobber a concurrent edit to a child's own
   * fields — unlike the whole-array `set` this replaces.
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
 * Management API. `component` is excluded here only when no op targets it —
 * `renameBlock` does, so it is diffed like any other key below.
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
  return Array.isArray(value) && value.length > 0 && value.every(isBlock);
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
 * within a story and must be present. The backend regenerates the `_uid` of the
 * second block that repeats one, and generates a `_uid` for a block that has
 * none — in both cases the patch and inverse recorded locally would address a
 * block that does not exist remotely, and the rollback would silently no-op.
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

    if (isBlockList(beforeValue) || isBlockList(afterValue)) {
      const beforeList = Array.isArray(beforeValue) ? (beforeValue as AnyBlock[]) : [];
      const afterList = Array.isArray(afterValue) ? (afterValue as AnyBlock[]) : [];
      const beforeUids = beforeList.map((b) => b._uid);
      const afterUids = afterList.map((b) => b._uid);
      afterList.forEach((block, index) => {
        if (!beforeUids.includes(block._uid)) {
          ops.push({ kind: "listInsert", key, uid: block._uid, index, block });
        }
      });
      for (const uid of beforeUids) {
        if (!afterUids.includes(uid)) ops.push({ kind: "listRemove", key, uid });
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

/**
 * Reports every op of a block patch whose live value no longer matches what the
 * migration left behind.
 */
function conflictsOf(block: AnyBlock, patch: BlockPatch): ApplyConflict[] {
  const conflicts: ApplyConflict[] = [];
  for (const op of patch.ops) {
    if (op.kind === "set" || op.kind === "unset") {
      const expected = "expect" in op ? op.expect : undefined;
      if (!deepEqual(ownView(block[op.key]), ownView(expected))) {
        conflicts.push({
          uid: patch.uid,
          key: op.key,
          reason: `live value differs from the value the migration wrote`,
        });
      }
      continue;
    }
    if (op.kind === "listOrder") {
      const list = Array.isArray(block[op.key]) ? (block[op.key] as AnyBlock[]) : [];
      const liveKnown = list
        .filter(isBlock)
        .map((item) => item._uid)
        .filter((uid) => op.expect.includes(uid));
      if (!deepEqual(liveKnown, op.expect)) {
        conflicts.push({
          uid: patch.uid,
          key: op.key,
          reason: `live order of "${op.key}" differs from the order the migration wrote`,
        });
      }
    }
  }
  return conflicts;
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
 */
export function applyPatches(
  content: unknown,
  patches: BlockPatch[],
  options: { force?: boolean } = {},
): ApplyResult {
  const index = indexBlocks(content);
  const result: ApplyResult = { applied: 0, conflicts: [], missing: [] };

  for (const patch of patches) {
    const block = index.get(patch.uid);
    if (!block) {
      result.missing.push(patch.uid);
      continue;
    }
    const conflicts = options.force ? [] : conflictsOf(block, patch);
    if (conflicts.length > 0) {
      result.conflicts.push(...conflicts);
      continue;
    }
    for (const op of patch.ops) {
      switch (op.kind) {
        case "set":
        case "unset": {
          if (op.kind === "set") {
            block[op.key] = op.value;
          } else {
            delete block[op.key];
          }
          result.applied++;
          break;
        }
        case "listInsert": {
          const list = Array.isArray(block[op.key]) ? (block[op.key] as AnyBlock[]) : [];
          if (list.some((item) => isBlock(item) && item._uid === op.uid)) break;
          list.splice(Math.min(op.index, list.length), 0, op.block);
          block[op.key] = list;
          result.applied++;
          break;
        }
        case "listOrder": {
          const list = Array.isArray(block[op.key]) ? (block[op.key] as AnyBlock[]) : [];
          const rank = new Map(op.uids.map((uid, index) => [uid, index]));
          // Children the patch does not know about keep their live slot; the
          // known ones are re-dealt into the slots they already occupied.
          const slots: number[] = [];
          list.forEach((item, index) => {
            if (isBlock(item) && rank.has(item._uid)) slots.push(index);
          });
          const ordered = op.uids
            .map((uid) => list.find((item) => isBlock(item) && item._uid === uid))
            .filter((item): item is AnyBlock => item !== undefined);
          slots.forEach((slot, index) => {
            list[slot] = ordered[index]!;
          });
          block[op.key] = list;
          result.applied++;
          break;
        }
        case "listRemove": {
          const list = Array.isArray(block[op.key]) ? (block[op.key] as AnyBlock[]) : [];
          const at = list.findIndex((item) => isBlock(item) && item._uid === op.uid);
          if (at === -1) break;
          list.splice(at, 1);
          result.applied++;
          break;
        }
      }
    }
  }

  return result;
}
