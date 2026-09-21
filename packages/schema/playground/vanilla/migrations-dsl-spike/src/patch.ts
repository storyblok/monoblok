/**
 * SPIKE — prototype quality. Not a shipped API.
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
  | { kind: "listRemove"; key: string; uid: string };

export interface BlockPatch {
  uid: string;
  component: string;
  ops: BlockPatchOp[];
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
    if (key === "_uid" || key === "component") continue;
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
      // Pure reordering is not expressible by uid-scoped insert/remove; fall back
      // to a whole-value replacement, which a concurrent edit can conflict with.
      const survivorsBefore = beforeUids.filter((uid) => afterUids.includes(uid));
      const survivorsAfter = afterUids.filter((uid) => beforeUids.includes(uid));
      if (!deepEqual(survivorsBefore, survivorsAfter)) {
        ops.push({ kind: "set", key, value: afterValue, expect: beforeValue });
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
 * Replays patches against live content. A `set`/`unset` whose live value no
 * longer matches what the migration left behind is reported as a conflict and
 * skipped, so an edit made after the migration is never clobbered.
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
    for (const op of patch.ops) {
      switch (op.kind) {
        case "set":
        case "unset": {
          const live = block[op.key];
          const expected = "expect" in op ? op.expect : undefined;
          if (!options.force && !deepEqual(ownView(live), ownView(expected))) {
            result.conflicts.push({
              uid: patch.uid,
              key: op.key,
              reason: `live value differs from the value the migration wrote`,
            });
            continue;
          }
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
