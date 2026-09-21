/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * Applies a compiled migration to one story's content and returns the patch it
 * produced plus the inverse patch a rollback would replay.
 */
import type { AnyChild, CompiledMigration, MigrationOp } from "./define-migration";
import { type AnyBlock, type BlockPatch, diffBlock, indexBlocks, isBlock } from "./patch";

export interface StoryMigrationResult {
  changed: boolean;
  content: unknown;
  /** Blocks the migration's targets matched, whether or not they changed. */
  matched: number;
  patches: BlockPatch[];
  inverse: BlockPatch[];
}

function coerce(value: unknown, to: "string" | "number" | "boolean"): unknown {
  if (value === null || value === undefined) return value;
  if (to === "string") return typeof value === "string" ? value : String(value);
  if (to === "number") {
    // A Storyblok `number` field stores its value as a string, and an unset one
    // stores `""`. Writing a JSON number would leave every migrated story with
    // a value no editor would have produced.
    const asNumber = typeof value === "number" ? value : Number(String(value).trim());
    return Number.isFinite(asNumber) && String(value).trim() !== "" ? String(asNumber) : "";
  }
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0 || value === "") return false;
  return Boolean(value);
}

/** Rewrites a key in place while keeping its position in the object. */
function renameKey(block: AnyBlock, from: string, to: string): void {
  if (!(from in block)) return;
  const entries = Object.entries(block).map(([key, value]) =>
    key === from ? ([to, value] as const) : ([key, value] as const),
  );
  for (const key of Object.keys(block)) delete block[key];
  for (const [key, value] of entries) block[key] = value;
}

function applyOp(block: AnyBlock, op: MigrationOp): void {
  switch (op.type) {
    case "rename":
      renameKey(block, op.from, op.to);
      break;
    case "move":
      if (op.from in block) {
        block[op.to] = block[op.from];
        delete block[op.from];
      }
      break;
    case "remove":
      delete block[op.field];
      break;
    case "coerce":
      if (op.field in block) block[op.field] = coerce(block[op.field], op.to);
      break;
    case "reorder": {
      const list = block[op.field];
      if (Array.isArray(list) && list.every(isBlock)) {
        block[op.field] = [...(list as AnyChild[])].sort(op.compare);
      }
      break;
    }
    case "alter": {
      const returned = op.fn(block);
      if (returned && returned !== block && typeof returned === "object") {
        for (const key of Object.keys(block)) {
          if (!(key in returned)) delete block[key];
        }
        Object.assign(block, returned);
      }
      break;
    }
  }
}

/**
 * Component names of every block above each block in the tree, so an op scoped
 * with `.under(parent)` can be limited to one location.
 */
export function indexAncestors(
  content: unknown,
  chain: readonly string[] = [],
  into = new Map<string, Set<string>>(),
): Map<string, Set<string>> {
  if (Array.isArray(content)) {
    for (const item of content) indexAncestors(item, chain, into);
    return into;
  }
  if (typeof content === "object" && content !== null) {
    const nextChain = isBlock(content) ? [...chain, content.component] : chain;
    if (isBlock(content)) into.set(content._uid, new Set(chain));
    for (const value of Object.values(content)) indexAncestors(value, nextChain, into);
  }
  return into;
}

export function runMigrationOnStory(
  migration: CompiledMigration,
  content: unknown,
): StoryMigrationResult {
  const before = structuredClone(content);
  const after = structuredClone(content);

  const beforeIndex = indexBlocks(before);
  const ancestors = indexAncestors(after);

  let matched = 0;
  for (const [uid, block] of indexBlocks(after)) {
    const ops = migration.ops.filter(
      (op) => op.block === block.component && (!op.under || ancestors.get(uid)?.has(op.under)),
    );
    if (ops.length === 0) continue;
    matched++;
    for (const op of ops) applyOp(block, op);
  }

  // Re-index: an `alter` may have added or removed nested blocks.
  const afterIndexFinal = indexBlocks(after);
  const patches: BlockPatch[] = [];
  const inverse: BlockPatch[] = [];
  for (const [uid, beforeBlock] of beforeIndex) {
    const afterBlock = afterIndexFinal.get(uid);
    if (!afterBlock) continue; // captured by the parent's listRemove/listInsert ops
    const forward = diffBlock(beforeBlock, afterBlock);
    if (!forward) continue;
    patches.push(forward);
    const backward = diffBlock(afterBlock, beforeBlock);
    if (backward) inverse.push(backward);
  }

  return {
    changed: patches.length > 0,
    content: after,
    matched,
    patches,
    inverse,
  };
}

/** Every block instance in a story tree, for reporting. */
export function blockComponents(content: unknown): string[] {
  return [...indexBlocks(content).values()].map((block) => block.component);
}

export { isBlock };
