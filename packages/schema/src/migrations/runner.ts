/**
 * Applies a compiled migration to one story's content and returns the patch it
 * produced plus the inverse patch an undo would replay.
 */
import type { CompiledMigration } from "./define-migration";
import {
  type AlterFieldContext,
  type AnyChild,
  type CoercionTarget,
  type ExpandBlockOp,
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
   * Blocks left with a repeated or absent `_uid`. Saving a story re-uids these,
   * which would strand the patch that addresses them, so a runner must refuse
   * to write content that reports any — under either heading.
   *
   * `duplicate` and `missing` count only what the migration introduced;
   * `preExisting` names the uids the content already repeated before it ran. A
   * caller refuses both, but the message it prints can name the right culprit.
   */
  unstableUids: { duplicate: string[]; missing: number; preExisting: string[] };
  /**
   * Ops that changed a block again when the whole migration ran a second time
   * over its own output. A rerun would keep changing the story, so a runner
   * must refuse it.
   *
   * Any op kind can land here. A callback that toggles a value is the obvious
   * case, but a structural op can fail to settle on the content, and two ops
   * can undo each other's work.
   */
  nonIdempotent: { uid: string; op: number }[];
  /**
   * Ops that declined to change a block because the change would lose data or
   * corrupt the block, with the reason. A callback that throws lands here too.
   * A runner must refuse the story.
   */
  refusedOps: { uid: string; op: number; reason: string }[];
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

const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const TRUE_VALUES: readonly unknown[] = [true, "true", "1", 1];
const FALSE_VALUES: readonly unknown[] = [false, "false", "0", 0, ""];

/** The converted value, or `undefined` when the value has no faithful counterpart. */
function coerce(value: unknown, to: CoercionTarget): { value: unknown } | undefined {
  if (value === null || value === undefined) return { value };
  if (typeof value === "object") return undefined;
  if (to === "string") return { value: String(value) };
  if (to === "number") {
    // A Storyblok `number` field stores its value as a string, and an unset one
    // stores `""`. Writing a JSON number would leave every migrated story with
    // a value no editor would have produced.
    if (typeof value === "number")
      return Number.isFinite(value) ? { value: String(value) } : undefined;
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed === "") return { value: "" };
    return DECIMAL.test(trimmed) ? { value: String(Number(trimmed)) } : undefined;
  }
  if (TRUE_VALUES.includes(value)) return { value: true };
  if (FALSE_VALUES.includes(value)) return { value: false };
  return undefined;
}

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
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
function renameFieldFamily(
  block: AnyBlock,
  from: string,
  to: string,
  overwrite: boolean,
): string | undefined {
  const sourceKeys = [from, ...translationKeysFor(block, from)].filter((key) => key in block);
  // Nothing to move. Leaving early is also what makes a rerun a no-op, since
  // the second pass finds the family already sitting on the target name.
  if (sourceKeys.length === 0 || from === to) return undefined;

  const targetKeys = [to, ...translationKeysFor(block, to)];
  if (!overwrite && !isEmptyValue(block[to])) {
    return `field "${to}" already holds a value, and renaming "${from}" onto it would overwrite it. Use \`moveField\` to overwrite it on purpose.`;
  }

  // The target's whole family goes first. Dropping only the keys the source
  // replaces would leave a translation of the target with no counterpart on
  // the source in place, where it would then be read as a translation of the
  // value that just landed on top of it.
  for (const key of targetKeys) delete block[key];

  for (const key of sourceKeys) renameKey(block, key, `${to}${key.slice(from.length)}`);
  return undefined;
}

/**
 * Applies one op to one block. Returns the reason instead of writing anything
 * when the op would lose data or corrupt the block.
 */
function applyOp(block: AnyBlock, op: MigrationOp): string | undefined {
  switch (op.kind) {
    case "renameField":
    case "moveField":
      return renameFieldFamily(block, op.field, op.to, op.kind === "moveField");
    case "removeField":
      delete block[op.field];
      for (const key of translationKeysFor(block, op.field)) delete block[key];
      break;
    case "coerceField": {
      const keys = [op.field, ...translationKeysFor(block, op.field)].filter((key) => key in block);
      const converted = keys.map((key) => coerce(block[key], op.to));
      const failed = keys.find((_, at) => converted[at] === undefined);
      if (failed !== undefined) {
        return `field "${failed}" holds ${JSON.stringify(block[failed])?.slice(0, 80)}, which has no ${op.to} counterpart.`;
      }
      keys.forEach((key, at) => {
        block[key] = converted[at]!.value;
      });
      break;
    }
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
      // The callback works on a copy, so a refused result leaves the block as it was.
      const draft = structuredClone(block);
      const returned = op.fn(draft as never);
      const next =
        typeof returned === "object" && returned !== null
          ? (returned as Record<string, unknown>)
          : draft;
      if (next._uid !== block._uid || typeof next.component !== "string") {
        return "`alterBlock` has to return the whole block with its `_uid` and `component`; spread the block it receives into the result.";
      }
      for (const key of Object.keys(block)) {
        if (!(key in next)) delete block[key];
      }
      Object.assign(block, next);
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
  return undefined;
}

type PlacedBlock = { block: AnyBlock; chain: readonly string[] };

/**
 * Every block in the tree in document order, each with the component names of
 * the blocks above it, outermost first, so an op scoped with `under` can be
 * limited to one location. A list rather than a uid index, so a block that
 * repeats another's uid is still visited.
 */
function walkBlocks(
  content: unknown,
  chain: readonly string[] = [],
  into: PlacedBlock[] = [],
): PlacedBlock[] {
  if (Array.isArray(content)) {
    for (const item of content) walkBlocks(item, chain, into);
    return into;
  }
  if (typeof content === "object" && content !== null) {
    const nextChain = isBlock(content) ? [...chain, content.component] : chain;
    if (isBlock(content)) into.push({ block: content, chain });
    for (const value of Object.values(content)) walkBlocks(value, nextChain, into);
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
 * A key op always does. It changes the block schema, which is global, so
 * honoring an `under` that reached it anyway would migrate a subset and leave
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

type ScopedOp = { op: MigrationOp; index: number };

/**
 * `expandBlock` is the one op that changes a block's siblings rather than the
 * block, so it cannot be applied where the others are — the runner hands an op
 * a block, and the list holding it is not in reach from there. It gets its own
 * pass over the tree, after every other op has run, so a callback reads the
 * block as the migration left it.
 *
 * The blocks a callback returns are content the migration authored: no op is
 * applied to them in the same run, this one included. A callback that returns
 * a block of the component it matched would therefore expand again on the next
 * run, which the rerun probe reports.
 */
function expandBlocks(
  value: unknown,
  ops: readonly ScopedOp[],
  chain: readonly string[],
  report: PassReport,
): unknown {
  if (Array.isArray(value)) {
    const items = value.map((item) => expandBlocks(item, ops, chain, report));
    if (!items.some(isBlock)) return items;

    let expanded = false;
    const out: unknown[] = [];
    for (const item of items) {
      if (!isBlock(item)) {
        out.push(item);
        continue;
      }
      const match = ops.find(({ op }) => op.block === item.component && inScope(op, chain));
      if (!match) {
        out.push(item);
        continue;
      }
      report.matched.add(item._uid);
      let produced: unknown[];
      try {
        produced = [...(match.op as ExpandBlockOp<never, never>).fn(item as never)];
      } catch (error) {
        report.refusedOps.push({ uid: item._uid, op: match.index, reason: thrown(error) });
        out.push(item);
        continue;
      }
      report.changed.push({ uid: item._uid, op: match.index });
      out.push(...produced);
      expanded = true;
    }
    return expanded ? out : items;
  }

  if (typeof value === "object" && value !== null) {
    const holder = value as Record<string, unknown>;
    const nextChain = isBlock(value) ? [...chain, value.component] : chain;
    for (const key of Object.keys(holder)) {
      holder[key] = expandBlocks(holder[key], ops, nextChain, report);
    }
    return holder;
  }

  return value;
}

type PassReport = {
  matched: Set<string>;
  changed: { uid: string; op: number }[];
  refusedOps: StoryMigrationResult["refusedOps"];
  translatedReshapes: StoryMigrationResult["translatedReshapes"];
};

function thrown(error: unknown): string {
  return `the callback threw: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Runs every op in order over the whole tree.
 *
 * Every op addresses a block by the name and position it had before the
 * migration ran, the same names the `Before` schema types them against, so a
 * `renameBlock` does not change which later ops reach the block. A block the
 * migration created has no such name and no op reaches it.
 *
 * The tree is still walked again for each op, so an op reaches a block an
 * earlier op replaced with a copy. The original is looked up by object first,
 * so a repeated uid cannot borrow another block's name, then by uid.
 */
function runPass(content: unknown, ops: readonly MigrationOp[]): PassReport {
  const report: PassReport = {
    matched: new Set(),
    changed: [],
    refusedOps: [],
    translatedReshapes: [],
  };

  type Origin = { component: string; chain: readonly string[] };
  const byObject = new WeakMap<object, Origin>();
  const byUid = new Map<string, Origin>();
  for (const { block, chain } of walkBlocks(content)) {
    const origin = { component: block.component, chain };
    byObject.set(block, origin);
    if (!byUid.has(block._uid)) byUid.set(block._uid, origin);
  }

  ops.forEach((op, index) => {
    if (op.kind === "expandBlock") return;
    for (const { block } of walkBlocks(content)) {
      const origin = byObject.get(block) ?? byUid.get(block._uid);
      if (!origin || op.block !== origin.component || !inScope(op, origin.chain)) continue;
      report.matched.add(block._uid);
      const translated = translatedReshapeField(block, op);
      if (translated !== undefined) {
        report.translatedReshapes.push({ uid: block._uid, op: index, field: translated });
      }
      const before = structuredClone(comparableKeys(block));
      let refusal: string | undefined;
      try {
        refusal = applyOp(block, op);
      } catch (error) {
        refusal = thrown(error);
      }
      if (refusal !== undefined) {
        report.refusedOps.push({ uid: block._uid, op: index, reason: refusal });
      } else if (!deepEqual(before, comparableKeys(block))) {
        report.changed.push({ uid: block._uid, op: index });
      }
    }
  });

  const expansions = ops
    .map((op, index) => ({ op, index }))
    .filter(({ op }) => op.kind === "expandBlock");
  if (expansions.length > 0) expandBlocks(content, expansions, [], report);

  return report;
}

export function runMigrationOnStory(
  migration: CompiledMigration,
  content: unknown,
): StoryMigrationResult {
  const before = structuredClone(content);
  const after = structuredClone(content);

  const beforeIndex = indexBlocks(before);
  const unstableBefore = findUnstableUids(before);
  const pass = runPass(after, migration.ops);

  // The whole migration runs a second time over its own output, which is what
  // makes a rerun safe by construction rather than by convention. Anything
  // that changes again is reported, so the run is refused instead of a rerun
  // discovering it. An op refused on this pass is fine: a rerun would refuse
  // the story rather than change it.
  //
  // Not only the `alter` ops, whose callback is the obvious way to get this
  // wrong. A structural op can fail to settle on the content it is given:
  // unwrapping a container that nests inside itself lifts the next container
  // into the field the op reads, where the following run dissolves that one
  // too. And two ops can feed each other, like a rename onto a field that a
  // later op renames another field onto.
  const rerun = runPass(structuredClone(after), migration.ops);
  const nonIdempotent = rerun.changed.filter(
    (entry, at, all) =>
      all.findIndex((other) => other.uid === entry.uid && other.op === entry.op) === at,
  );

  const afterIndexFinal = indexBlocks(after);
  const patches: BlockPatch[] = [];
  const inverse: BlockPatch[] = [];
  for (const [uid, beforeBlock] of beforeIndex) {
    const afterBlock = afterIndexFinal.get(uid);
    if (!afterBlock) continue; // captured by the parent's listRemove/listInsert ops
    const forward = diffBlock(beforeBlock, afterBlock);
    if (!forward) continue;
    // Patches hold values by reference; a copy keeps a caller's edits to the
    // returned content out of the record of what the migration wrote.
    patches.push(structuredClone(forward));
    const backward = diffBlock(afterBlock, beforeBlock);
    if (backward) inverse.push(structuredClone(backward));
  }

  return {
    changed: patches.length > 0,
    content: after,
    matched: pass.matched.size,
    patches,
    inverse,
    unstableUids: instabilityCausedBy(unstableBefore, findUnstableUids(after)),
    nonIdempotent,
    refusedOps: pass.refusedOps,
    translatedReshapes: pass.translatedReshapes,
  };
}
