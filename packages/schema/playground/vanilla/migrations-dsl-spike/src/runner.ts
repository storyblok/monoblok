/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * Applies a compiled migration to one story's content and returns the patch it
 * produced plus the inverse patch a rollback would replay.
 */
import type { CompiledMigration } from "./define-migration";
import type { AlterFieldContext, AnyChild, MigrationOp } from "./ops";
import {
  type AnyBlock,
  type BlockPatch,
  deepEqual,
  diffBlock,
  findUnstableUids,
  indexBlocks,
  isBlock,
  languageOfKey,
  translationKeysFor,
} from "./patch";

export interface StoryMigrationResult {
  changed: boolean;
  content: unknown;
  /** Blocks the migration's targets matched, whether or not they changed. */
  matched: number;
  patches: BlockPatch[];
  inverse: BlockPatch[];
  /**
   * Blocks the migration left with a repeated or absent `_uid`. The backend
   * re-uids these on write, which would strand the patch that addresses them —
   * a runner must refuse to write content that reports any.
   */
  unstableUids: { duplicate: string[]; missing: number };
  /**
   * `alter` ops that did not agree with themselves on a second pass over the
   * same block. A rerun of the migration would keep moving, so the run is not
   * safe to repeat and a runner must refuse it.
   */
  nonIdempotent: { uid: string; op: number }[];
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

/**
 * Every op that names a field names its translations too. A field is not one
 * key but a family: the base key plus one `__i18n__<lang>` sibling per
 * translated language.
 */
function renameFieldFamily(block: AnyBlock, from: string, to: string): void {
  for (const key of [from, ...translationKeysFor(block, from)]) {
    const target = `${to}${key.slice(from.length)}`;
    // `moveField` allows an occupied target; dropping it first keeps the moved
    // value rather than the one it displaces.
    if (key in block && target in block) delete block[target];
    renameKey(block, key, target);
  }
}

function applyOp(block: AnyBlock, op: MigrationOp): void {
  switch (op.kind) {
    case "renameField":
    case "moveField":
      renameFieldFamily(block, op.field, op.to);
      break;
    case "removeField":
      delete block[op.field];
      for (const key of translationKeysFor(block, op.field)) delete block[key];
      break;
    case "coerceField":
      if (op.field in block) block[op.field] = coerce(block[op.field], op.to);
      for (const key of translationKeysFor(block, op.field)) {
        block[key] = coerce(block[key], op.to);
      }
      break;
    case "alterField": {
      for (const key of [op.field, ...translationKeysFor(block, op.field)]) {
        if (!(key in block)) continue;
        const context: AlterFieldContext = { key, language: languageOfKey(key) };
        block[key] = op.fn(block[key] as never, context);
      }
      break;
    }
    case "reorderField": {
      const list = block[op.field];
      if (Array.isArray(list) && list.every(isBlock)) {
        block[op.field] = [...(list as AnyChild[])].sort(op.compare);
      }
      break;
    }
    case "alterBlock": {
      const returned = op.fn(block as never);
      if (returned && returned !== block && typeof returned === "object") {
        const next = returned as Record<string, unknown>;
        for (const key of Object.keys(block)) {
          if (!(key in next)) delete block[key];
        }
        Object.assign(block, next);
      }
      break;
    }
  }
}

/**
 * Component names of every block above each block in the tree, outermost first,
 * so an op scoped with `under` can be limited to one location.
 */
export function indexAncestors(
  content: unknown,
  chain: readonly string[] = [],
  into = new Map<string, string[]>(),
): Map<string, string[]> {
  if (Array.isArray(content)) {
    for (const item of content) indexAncestors(item, chain, into);
    return into;
  }
  if (typeof content === "object" && content !== null) {
    const nextChain = isBlock(content) ? [...chain, content.component] : chain;
    if (isBlock(content)) into.set(content._uid, [...chain]);
    for (const value of Object.values(content)) indexAncestors(value, nextChain, into);
  }
  return into;
}

/**
 * An `under` constraint holds when its names appear on the ancestor chain in the
 * order given, gaps allowed. A single name is the one-element case, so
 * `under: "card"` still matches a card at any depth above the block — which is
 * what keeps a migration working after an editor wraps things one level deeper.
 */
export function matchesUnder(chain: readonly string[], under: string | readonly string[]): boolean {
  const wanted = typeof under === "string" ? [under] : under;
  let at = 0;
  for (const name of chain) {
    if (name === wanted[at]) at++;
    if (at === wanted.length) return true;
  }
  return wanted.length === 0;
}

/** The part of a block an idempotency check may compare: nested blocks excluded. */
function ownKeys(block: AnyBlock): Record<string, unknown> {
  return Object.fromEntries(Object.entries(block).filter(([key]) => key !== "_editable"));
}

export function runMigrationOnStory(
  migration: CompiledMigration,
  content: unknown,
): StoryMigrationResult {
  const before = structuredClone(content);
  const after = structuredClone(content);

  const beforeIndex = indexBlocks(before);
  const ancestors = indexAncestors(after);
  const nonIdempotent: { uid: string; op: number }[] = [];

  let matched = 0;
  for (const [uid, block] of indexBlocks(after)) {
    const chain = ancestors.get(uid) ?? [];
    const ops = migration.ops
      .map((op, index) => ({ op, index }))
      .filter(
        ({ op }) =>
          op.block === block.component &&
          (!("under" in op) || op.under === undefined || matchesUnder(chain, op.under)),
      );
    if (ops.length === 0) continue;
    matched++;
    for (const { op, index } of ops) {
      applyOp(block, op);
      // Every `alter` runs twice and must agree, which is what makes a rerun
      // safe by construction rather than by convention. The second pass runs on
      // a copy, so a non-idempotent op is reported rather than applied twice.
      if (op.kind === "alterBlock" || op.kind === "alterField") {
        const probe = structuredClone(block) as AnyBlock;
        applyOp(probe, op);
        if (!deepEqual(ownKeys(probe), ownKeys(block))) nonIdempotent.push({ uid, op: index });
      }
    }
  }

  // Re-index: an `alterBlock` may have added or removed nested blocks.
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
    unstableUids: findUnstableUids(after),
    nonIdempotent,
  };
}

/** Every block instance in a story tree, for reporting. */
export function blockComponents(content: unknown): string[] {
  return [...indexBlocks(content).values()].map((block) => block.component);
}

export { isBlock };
