/**
 * Not exported from the package root. Whether content migrations belong in
 * `@storyblok/schema` at all is open — see the prototype design doc; the
 * subpath export exists so this can move without breaking a consumer's import.
 *
 * The op factories. Each returns a plain object; nothing runs at module load,
 * so `--dry-run` needs no network call, a key op can be inverted from the op
 * alone, and a user can add an op by writing a function that returns one.
 *
 * Every op type carries the two schema parameters on a phantom property. A
 * top-level factory is called in the argument list of
 * `defineMigration<Schema>([…])`, where the schema appears in no inferrable
 * argument position, so the contextual return type is the only channel it can
 * learn them from — and a type parameter has to occur in the return type for
 * that channel to exist. Whether TypeScript actually threads it is the first
 * thing `define-migration.test-d.ts` pins down.
 */
import type {
  BlockNameOf,
  ContentOf,
  SchemaShape,
  SourceBlockName,
  SourceFieldName,
  TargetFieldName,
} from "./types";

declare const schemaBrand: unique symbol;

/** A child block as the reorder comparator sees it. */
export type AnyChild = Record<string, unknown> & { _uid: string; component: string };

export type CoercionTarget = "string" | "number" | "boolean";

/**
 * An ancestor constraint: one block name matched anywhere above the selection,
 * or an outermost-first chain in which each name must appear above the next.
 * Gaps are allowed at every step, so `["page", "card"]` still matches a card
 * wrapped in a grid inside the page. Matching the ancestor chain rather than the
 * direct parent is what keeps a migration working after an editor nests things
 * one level deeper.
 */
export type UnderOf<TBefore extends SchemaShape> =
  | BlockNameOf<TBefore>
  | readonly BlockNameOf<TBefore>[];

/** Context an `alterField` callback receives alongside the value. */
export interface AlterFieldContext {
  /**
   * The language of the key being visited, `undefined` for the base key that
   * holds the default language. Resolved from the block's own keys at run time,
   * never from the schema — the language set is space state and differs between
   * the spaces one migration is expected to run against.
   */
  language?: string;
  /** The key actually being written, base or `__i18n__` sibling. */
  key: string;
}

export interface RenameFieldOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "renameField";
  block: string;
  field: string;
  to: string;
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface MoveFieldOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "moveField";
  block: string;
  field: string;
  to: string;
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface RemoveFieldOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "removeField";
  block: string;
  field: string;
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface CoerceFieldOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "coerceField";
  block: string;
  field: string;
  to: CoercionTarget;
  /** Present only when the author stated it; without it the op cannot be inverted. */
  from?: CoercionTarget;
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface ReorderFieldOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "reorderField";
  block: string;
  field: string;
  compare: (a: AnyChild, b: AnyChild) => number;
  under?: string | readonly string[];
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface AlterFieldOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "alterField";
  block: string;
  field: string;
  fn: (value: never, context: AlterFieldContext) => unknown;
  under?: string | readonly string[];
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface AlterBlockOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "alterBlock";
  block: string;
  fn: (block: never) => unknown;
  under?: string | readonly string[];
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface AddFieldOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "addField";
  block: string;
  field: string;
  /** Returning `undefined` leaves the block untouched. */
  fn: (block: never) => unknown;
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface SplitFieldOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "splitField";
  block: string;
  field: string;
  into: readonly string[];
  split: (value: never) => readonly unknown[];
  /** Present only when the author stated it; without it the op cannot be inverted. */
  merge?: (values: readonly unknown[]) => unknown;
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export interface MergeFieldsOp<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  kind: "mergeFields";
  block: string;
  fields: readonly string[];
  into: string;
  merge: (values: readonly unknown[]) => unknown;
  /** Present only when the author stated it; without it the op cannot be inverted. */
  split?: (value: never) => readonly unknown[];
  readonly [schemaBrand]?: [TAfter, TBefore];
}

export type MigrationOpOf<TAfter extends SchemaShape, TBefore extends SchemaShape> =
  | RenameFieldOp<TAfter, TBefore>
  | MoveFieldOp<TAfter, TBefore>
  | RemoveFieldOp<TAfter, TBefore>
  | CoerceFieldOp<TAfter, TBefore>
  | ReorderFieldOp<TAfter, TBefore>
  | AlterFieldOp<TAfter, TBefore>
  | AlterBlockOp<TAfter, TBefore>
  | AddFieldOp<TAfter, TBefore>
  | SplitFieldOp<TAfter, TBefore>
  | MergeFieldsOp<TAfter, TBefore>;

/** An op as the runner sees it: the schema brand is phantom and carries nothing. */
export type MigrationOp = MigrationOpOf<SchemaShape, SchemaShape>;

/** The op kinds that move the component schema and so must apply everywhere. */
export const KEY_OP_KINDS = [
  "renameField",
  "moveField",
  "removeField",
  "coerceField",
  "addField",
  "splitField",
  "mergeFields",
] as const;

export function isKeyOp(op: MigrationOp): boolean {
  return (KEY_OP_KINDS as readonly string[]).includes(op.kind);
}

/**
 * A key op moves the component schema, which is global: migrating only the
 * instances under one parent would leave every other instance holding a key no
 * schema describes. So the spec objects have no `under`, and passing one is an
 * excess-property error on the object literal.
 */
interface KeyOpSpec<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  TBlock extends string,
> {
  block: TBlock;
  field: SourceFieldName<TAfter, TBefore, TBlock>;
  /**
   * Declared, rather than merely absent, so the rule survives a spec that is not
   * a fresh object literal: excess-property checking fires only on a literal, so
   * a spread or a hoisted variable used to slip through. The type is the
   * explanation, which is what the compiler then prints.
   */
  under?: "`under` is not allowed on a key op: a component's schema is global, so a key op applies to every instance";
}

/** A value op: the schema does not move, so a subset of instances is coherent. */
interface ValueOpSpec<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  TBlock extends string,
> {
  block: TBlock;
  field: SourceFieldName<TAfter, TBefore, TBlock>;
  under?: UnderOf<TBefore>;
}

/** The pre-migration value type of `<block>.<field>`, or `unknown` when unknowable. */
type SourceValue<TBefore extends SchemaShape, TBlock extends string, TField> =
  TBlock extends BlockNameOf<TBefore>
    ? TField extends keyof ContentOf<TBefore, TBlock>
      ? ContentOf<TBefore, TBlock>[TField]
      : unknown
    : unknown;

/**
 * A key op never honours `under`, but it carries one through when a caller
 * smuggled it past the type system, so `validateMigration` can name the problem
 * instead of the op silently applying everywhere.
 */
function carriedUnder(spec: { under?: unknown }): { under?: string | readonly string[] } {
  return spec.under === undefined ? {} : { under: spec.under as string | readonly string[] };
}

export function renameField<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
>(
  spec: KeyOpSpec<TAfter, TBefore, TBlock> & { to: TargetFieldName<TAfter, TBlock> },
): RenameFieldOp<TAfter, TBefore> {
  return {
    kind: "renameField",
    block: spec.block,
    field: spec.field,
    to: spec.to,
    ...carriedUnder(spec),
  };
}

/** Like `renameField`, but the target may already hold a value; it is overwritten. */
export function moveField<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
>(
  spec: KeyOpSpec<TAfter, TBefore, TBlock> & { to: TargetFieldName<TAfter, TBlock> },
): MoveFieldOp<TAfter, TBefore> {
  return {
    kind: "moveField",
    block: spec.block,
    field: spec.field,
    to: spec.to,
    ...carriedUnder(spec),
  };
}

export function removeField<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
>(spec: KeyOpSpec<TAfter, TBefore, TBlock>): RemoveFieldOp<TAfter, TBefore> {
  return { kind: "removeField", block: spec.block, field: spec.field, ...carriedUnder(spec) };
}

/**
 * `from` is optional and only ever used to invert the op. Stating it is what
 * moves a coercion from "needs recorded patches" to "rolls back on any machine".
 */
export function coerceField<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
>(
  spec: KeyOpSpec<TAfter, TBefore, TBlock> & { to: CoercionTarget; from?: CoercionTarget },
): CoerceFieldOp<TAfter, TBefore> {
  return {
    kind: "coerceField",
    block: spec.block,
    field: spec.field,
    to: spec.to,
    ...(spec.from === undefined ? {} : { from: spec.from }),
    ...carriedUnder(spec),
  };
}

export function reorderField<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
>(
  spec: ValueOpSpec<TAfter, TBefore, TBlock>,
  compare: (a: AnyChild, b: AnyChild) => number,
): ReorderFieldOp<TAfter, TBefore> {
  return {
    kind: "reorderField",
    block: spec.block,
    field: spec.field,
    compare,
    ...(spec.under === undefined ? {} : { under: spec.under }),
  };
}

/**
 * Rewrites one field's value, translations included: the callback is invoked
 * once per key in the field's `__i18n__` family, with the language it belongs to.
 */
export function alterField<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
  const TField extends SourceFieldName<TAfter, TBefore, TBlock>,
>(
  spec: { block: TBlock; field: TField; under?: UnderOf<TBefore> },
  fn: (value: SourceValue<TBefore, TBlock, TField>, context: AlterFieldContext) => unknown,
): AlterFieldOp<TAfter, TBefore> {
  return {
    kind: "alterField",
    block: spec.block,
    field: spec.field,
    fn: fn as AlterFieldOp<TAfter, TBefore>["fn"],
    ...(spec.under === undefined ? {} : { under: spec.under }),
  };
}

/**
 * The escape hatch. Reads the pre-migration shape, returns the post-migration
 * shape; a mutating callback returning nothing is allowed for the common case
 * where the two agree. Unlike every other op it hands over raw keys, so the
 * translation family rule cannot help here.
 */
export function alterBlock<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
>(
  spec: { block: TBlock; under?: UnderOf<TBefore> },
  fn: (
    block: TBlock extends BlockNameOf<TBefore>
      ? ContentOf<TBefore, TBlock>
      : Record<string, unknown>,
  ) => void | (TBlock extends BlockNameOf<TAfter> ? ContentOf<TAfter, TBlock> : never),
): AlterBlockOp<TAfter, TBefore> {
  return {
    kind: "alterBlock",
    block: spec.block,
    fn: fn as AlterBlockOp<TAfter, TBefore>["fn"],
    ...(spec.under === undefined ? {} : { under: spec.under }),
  };
}

/**
 * Introduces a field, backfilled from the block it lands on. The backfill only
 * runs where the field is absent, so a rerun cannot overwrite an editor's
 * later correction — which is also what makes the op idempotent.
 */
export function addField<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
>(
  spec: { block: TBlock; field: TargetFieldName<TAfter, TBlock> },
  fn: (
    block: TBlock extends BlockNameOf<TBefore>
      ? ContentOf<TBefore, TBlock>
      : Record<string, unknown>,
  ) => unknown,
): AddFieldOp<TAfter, TBefore> {
  return {
    kind: "addField",
    block: spec.block,
    field: spec.field,
    fn: fn as AddFieldOp<TAfter, TBefore>["fn"],
  };
}

/**
 * One field into several. `merge` is the counterpart that puts them back; it is
 * optional, and stating it is what moves the op from "needs recorded patches"
 * to "rolls back on any machine".
 */
export function splitField<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
  // Defaulted, not only constrained: a caller pinning the schema parameters to
  // derive an inverse (`splitField<After, Before, "author">(...)`) supplies a
  // partial explicit list, and without a default TypeScript requires all four
  // or none — it does not infer a trailing parameter once any is written out.
  const TField extends SourceFieldName<TAfter, TBefore, TBlock> = SourceFieldName<
    TAfter,
    TBefore,
    TBlock
  >,
>(
  spec: {
    block: TBlock;
    field: TField;
    into: readonly TargetFieldName<TAfter, TBlock>[];
    merge?: (values: readonly unknown[]) => unknown;
  },
  split: (value: SourceValue<TBefore, TBlock, TField>) => readonly unknown[],
): SplitFieldOp<TAfter, TBefore> {
  return {
    kind: "splitField",
    block: spec.block,
    field: spec.field,
    into: spec.into,
    split: split as SplitFieldOp<TAfter, TBefore>["split"],
    ...(spec.merge === undefined ? {} : { merge: spec.merge }),
  };
}

/** Several fields into one. `split` is the counterpart, on the same terms. */
export function mergeFields<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
  const TBlock extends SourceBlockName<TAfter, TBefore>,
>(
  spec: {
    block: TBlock;
    fields: readonly SourceFieldName<TAfter, TBefore, TBlock>[];
    into: TargetFieldName<TAfter, TBlock>;
    split?: (value: never) => readonly unknown[];
  },
  merge: (values: readonly unknown[]) => unknown,
): MergeFieldsOp<TAfter, TBefore> {
  return {
    kind: "mergeFields",
    block: spec.block,
    fields: spec.fields,
    into: spec.into,
    merge,
    ...(spec.split === undefined ? {} : { split: spec.split }),
  };
}
