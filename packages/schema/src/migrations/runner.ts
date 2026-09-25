/**
 * Not exported from the package root. Whether content migrations belong in
 * `@storyblok/schema` at all is open — see the prototype design doc; the
 * subpath export exists so this can move without breaking a consumer's import.
 *
 * Applies a compiled migration to one story's content and returns the patch it
 * produced plus the inverse patch a rollback would replay.
 */
import type { CompiledMigration } from "./define-migration";
import {
  type AlterFieldContext,
  type AnyChild,
  isKeyOp,
  type MigrationOp,
  type ReorderContext,
} from "./ops";
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
   * Blocks left with a repeated or absent `_uid`. The backend re-uids these on
   * write, which would strand the patch that addresses them, so a runner must
   * refuse to write content that reports any — under either heading.
   *
   * `duplicate` and `missing` count only what the migration introduced;
   * `preExisting` names the uids the content already repeated before it ran. A
   * caller refuses both, but the message it prints can name the right culprit.
   */
  unstableUids: { duplicate: string[]; missing: number; preExisting: string[] };
  /**
   * Ops that did not agree with themselves on a second pass over the same
   * block. A rerun of the migration would keep moving, so the run is not safe
   * to repeat and a runner must refuse it.
   *
   * Any op kind can land here. A callback that toggles a value is the obvious
   * case, but a structural op can fail to settle on the content rather than on
   * the way it was written.
   */
  nonIdempotent: { uid: string; op: number }[];
  /**
   * Reshaping ops that touch a field carrying translations. `splitField` and
   * `mergeFields` produce a value out of one or more others, and there is no
   * answer the engine can pick for what a split of a German value should be:
   * the base key and its `__i18n__` siblings hold different text, and the
   * halves of one are not the halves of the other. Guessing would leave the
   * translations addressed to a field name that no longer exists, which the
   * delivery API then drops. So they are reported and a runner must refuse
   * them, rather than migrated on a rule nobody chose.
   */
  translatedReshapes: { uid: string; op: number; field: string }[];
}

/**
 * The field of a reshaping op that carries translations in this block, or
 * `undefined` when there is none. Only `splitField` and `mergeFields` can land
 * here: every other op that names a field moves the whole family.
 *
 * Targets count as much as sources. A target that already holds translations
 * keeps them when the merged or split value lands on it, where they are then
 * read as translations of a value they never translated — the same hazard
 * `renameFieldFamily` clears the target's family to avoid.
 */
function translatedReshapeField(block: AnyBlock, op: MigrationOp): string | undefined {
  const fields =
    op.kind === "splitField"
      ? [op.field, ...op.into]
      : op.kind === "mergeFields"
        ? [...op.fields, op.into]
        : [];
  return fields.find((field) => translationKeysFor(block, field).length > 0);
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
  const sourceKeys = [from, ...translationKeysFor(block, from)].filter((key) => key in block);
  // Nothing to move. Leaving early is also what makes a rerun a no-op, since
  // the second pass finds the family already sitting on the target name.
  if (sourceKeys.length === 0 || from === to) return;

  // `moveField` allows an occupied target, so the target's whole family goes
  // first. Dropping only the keys the source replaces would leave a translation
  // of the target with no counterpart on the source in place, where it would
  // then be read as a translation of the value that just landed on top of it.
  for (const key of [to, ...translationKeysFor(block, to)]) delete block[key];

  for (const key of sourceKeys) renameKey(block, key, `${to}${key.slice(from.length)}`);
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
        const siblings = [...(list as AnyChild[])];
        const positions = new Map(siblings.map((child, at) => [child, at]));
        const context: ReorderContext = {
          siblings,
          index: (child) => positions.get(child) ?? -1,
        };
        block[op.field] = [...siblings].sort((a, b) => op.compare(a, b, context));
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
    case "addField": {
      if (op.field in block) break;
      const value = op.fn(block as never);
      if (value === undefined) break;
      block[op.field] = value;
      break;
    }
    case "splitField": {
      const value = block[op.field];
      if (value === undefined || value === null) break;
      const parts = op.split(value as never);
      // The source goes first: `into` may name the source itself, and deleting
      // afterwards would take the part that landed on it with it. The op does
      // not become usable that way — a part sitting on the source name is split
      // again on the next pass, so the idempotency probe reports it and a
      // runner refuses it — but a loud refusal is not silent data loss.
      delete block[op.field];
      op.into.forEach((name, at) => {
        block[name] = parts[at];
      });
      break;
    }
    case "mergeFields": {
      if (!op.fields.some((name) => name in block)) break;
      const merged = op.merge(op.fields.map((name) => block[name]));
      // Same reason as `splitField`: `into` may be one of the sources, so the
      // sources are cleared before the merged value lands on the target.
      for (const name of op.fields) delete block[name];
      block[op.into] = merged;
      break;
    }
    case "renameBlock":
      block.component = op.to;
      break;
    case "wrapChildren": {
      const children = block[op.field];
      if (!Array.isArray(children) || children.length === 0) break;
      // Derived from the parent and the field so a rerun produces the same
      // uid, the backend has no reason to regenerate it on the write, and two
      // fields wrapped into the same container component do not collide.
      const wrapperUid = `${block._uid}-${op.field}-${op.in}`;
      // Already wrapped: a rerun must not add a second layer.
      if (
        children.length === 1 &&
        isBlock(children[0]) &&
        children[0].component === op.in &&
        children[0]._uid === wrapperUid
      ) {
        break;
      }
      block[op.field] = [
        {
          _uid: wrapperUid,
          component: op.in,
          [op.into]: children,
        },
      ];
      break;
    }
    case "unwrapChildren": {
      const children = block[op.field];
      if (!Array.isArray(children)) break;
      let matchedAny = false;
      const flattened = children.flatMap((child) => {
        if (!isBlock(child) || child.component !== op.unwrap) return [child];
        matchedAny = true;
        const inner = child[op.from];
        return Array.isArray(inner) ? inner : [];
      });
      if (!matchedAny) break;
      block[op.field] = flattened;
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

/**
 * Whether an op applies to a block at this position.
 *
 * A key op always does. It moves the component schema, which is global, so
 * honouring an `under` that reached it anyway would migrate a subset and leave
 * every other instance holding a key no schema describes. The type system
 * rejects the combination and `validateMigration` refuses the migration; this is
 * the third guard, so that a key op that slipped through both still cannot
 * half-apply.
 */
function inScope(op: MigrationOp, chain: readonly string[]): boolean {
  if (isKeyOp(op)) return true;
  const under = "under" in op ? op.under : undefined;
  return under === undefined || matchesUnder(chain, under);
}

type UidInstability = { duplicate: string[]; missing: number };

/**
 * Splits the instability the migration caused from the instability it inherited.
 * Without the split every duplicate uid reads as the migration's doing, and a
 * run over content an editor already broke would blame the wrong thing.
 */
function instabilityCausedBy(
  before: UidInstability,
  after: UidInstability,
): StoryMigrationResult["unstableUids"] {
  return {
    duplicate: after.duplicate.filter((uid) => !before.duplicate.includes(uid)),
    missing: Math.max(0, after.missing - before.missing),
    preExisting: after.duplicate.filter((uid) => before.duplicate.includes(uid)),
  };
}

/**
 * A block as the idempotency check compares it: everything but `_editable`,
 * which the delivery API injects for the Visual Editor and never stores, so it
 * is not part of what an op produced.
 *
 * Nested blocks stay in the comparison, unlike in a patch, where they collapse
 * to uid markers so a child's edits are not duplicated into its parent's patch.
 * The two concerns differ: an op that keeps rewriting a child's field is applied
 * at the parent, so the child is never visited with it and nothing else would
 * notice it creeping.
 */
function comparableKeys(block: AnyBlock): Record<string, unknown> {
  return Object.fromEntries(Object.entries(block).filter(([key]) => key !== "_editable"));
}

export function runMigrationOnStory(
  migration: CompiledMigration,
  content: unknown,
): StoryMigrationResult {
  const before = structuredClone(content);
  const after = structuredClone(content);

  const beforeIndex = indexBlocks(before);
  const unstableBefore = findUnstableUids(before);
  const ancestors = indexAncestors(after);
  const nonIdempotent: { uid: string; op: number }[] = [];
  const translatedReshapes: StoryMigrationResult["translatedReshapes"] = [];

  let matched = 0;
  for (const [uid, block] of indexBlocks(after)) {
    const chain = ancestors.get(uid) ?? [];
    const ops = migration.ops
      .map((op, index) => ({ op, index }))
      .filter(({ op }) => op.block === block.component && inScope(op, chain));
    if (ops.length === 0) continue;
    matched++;
    for (const { op, index } of ops) {
      const translated = translatedReshapeField(block, op);
      if (translated !== undefined) {
        translatedReshapes.push({ uid, op: index, field: translated });
      }
      applyOp(block, op);
      // Every op runs twice and must agree, which is what makes a rerun safe by
      // construction rather than by convention. The second pass runs on a copy,
      // so an op that does not settle is reported rather than applied twice.
      //
      // Not only the `alter` ops, whose callback is the obvious way to get this
      // wrong. A structural op can fail to settle on the content it is given
      // rather than on anything the author wrote: unwrapping a container that
      // nests inside itself lifts the next container into the field the op
      // reads, where the following run dissolves that one too. The
      // consequence is the same either way, so the check is too.
      const probe = structuredClone(block) as AnyBlock;
      applyOp(probe, op);
      if (!deepEqual(comparableKeys(probe), comparableKeys(block))) {
        nonIdempotent.push({ uid, op: index });
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
    unstableUids: instabilityCausedBy(unstableBefore, findUnstableUids(after)),
    nonIdempotent,
    translatedReshapes,
  };
}

/** Every block instance in a story tree, for reporting. */
export function blockComponents(content: unknown): string[] {
  return [...indexBlocks(content).values()].map((block) => block.component);
}

export { isBlock };
