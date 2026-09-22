/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * `defineMigration<Before, After>({ up })` under test.
 *
 * The probes here pass `{ name, up }`; the proposed API differs on both.
 * `name` exists only because the probes share one module and so have no
 * filename to be keyed by. The shipped form takes the builder callback directly
 * for the common forward-only case, and an object `{ title, up, down }` when the
 * author wants a hand-written inverse — recorded patches still take precedence
 * over `down`, since only they can tell that an editor changed the field since.
 *
 * Parameter order is also inverted from what is prototyped here. `After` comes
 * first (`defineMigration<After, Before = After>`), because one type parameter
 * has to mean the schema people actually have; under one parameter source paths
 * widen to `FieldPathOf<After> | (string & {})` rather than erroring.
 *
 * Two schema parameters, because one cannot describe both ends of a migration:
 * `Before` types the paths the migration reads, `After` types every name and
 * value it writes. `TAfter` defaults to `TBefore`, so the single-parameter
 * shorthand `defineMigration<Schema>` is the same signature with the default
 * filled in — no overload, and therefore no overload-resolution damage to the
 * two-parameter form.
 *
 * The builder records declarative operations; the runner (see `runner.ts`)
 * walks a story's content, applies them per block instance, and diffs each
 * touched instance to produce a patch and its inverse.
 */
import type {
  BlockNameOf,
  ContentOf,
  FieldNameIn,
  FieldPathOf,
  SchemaShape,
  TargetFieldName,
} from "./types";

export type MigrationOp =
  | { type: "rename"; block: string; from: string; to: string; under?: string }
  | { type: "remove"; block: string; field: string; under?: string }
  | {
      type: "coerce";
      block: string;
      field: string;
      to: "string" | "number" | "boolean";
      under?: string;
    }
  | { type: "move"; block: string; from: string; to: string; under?: string }
  /** Explicit reorder of a `bloks` array, so ordering never degrades to a whole-array replace. */
  | {
      type: "reorder";
      block: string;
      field: string;
      compare: (a: AnyChild, b: AnyChild) => number;
      under?: string;
    }
  | { type: "alter"; block: string; fn: (block: any) => any; under?: string };

/** A child block as the reorder comparator sees it. */
export type AnyChild = Record<string, unknown> & { _uid: string; component: string };

export interface FieldHandle<
  TBefore extends SchemaShape,
  TAfter extends SchemaShape,
  TBlock extends string,
> {
  /** Target name comes from the *post*-migration schema. */
  renameTo: (name: TargetFieldName<TAfter, TBlock>) => void;
  remove: () => void;
  asString: () => void;
  asNumber: () => void;
  asBoolean: () => void;
  /** Move this field's value onto another field of the same block. */
  moveTo: (name: TargetFieldName<TAfter, TBlock>) => void;
  /** Reorder a `bloks` array in place. Emits an order op, not a whole-array set. */
  reorder: (compare: (a: AnyChild, b: AnyChild) => number) => void;
}

export interface BlockHandle<
  TBefore extends SchemaShape,
  TAfter extends SchemaShape,
  TName extends BlockNameOf<TBefore>,
> {
  /**
   * Reads the pre-migration shape, returns the post-migration shape. A mutating
   * callback that returns nothing is still allowed for the common case where
   * the two shapes agree.
   */
  alter: (
    fn: (
      block: ContentOf<TBefore, TName>,
    ) => void | (TName extends BlockNameOf<TAfter> ? ContentOf<TAfter, TName> : never),
  ) => void;
  /** Field ops scoped to the same location as this handle. */
  field: (name: FieldNameIn<TBefore, TName>) => FieldHandle<TBefore, TAfter, TName>;
  /** Restrict every op recorded on this handle to instances nested under `parent`. */
  under: (parent: BlockNameOf<TBefore>) => BlockHandle<TBefore, TAfter, TName>;
}

export interface MigrationBuilder<TBefore extends SchemaShape, TAfter extends SchemaShape> {
  field: <TPath extends FieldPathOf<TBefore>>(
    path: TPath,
  ) => FieldHandle<TBefore, TAfter, TPath extends `${infer B}.${string}` ? B : never>;
  block: <TName extends BlockNameOf<TBefore>>(name: TName) => BlockHandle<TBefore, TAfter, TName>;
}

export interface MigrationDefinition<TBefore extends SchemaShape, TAfter extends SchemaShape> {
  /**
   * Spike only: the probes share one module, so there is no filename to take an
   * id from. Shipped migrations are one per file and keyed by that filename.
   */
  name?: string;
  up: (m: MigrationBuilder<TBefore, TAfter>) => void;
}

export interface CompiledMigration {
  name?: string;
  ops: MigrationOp[];
  /** Block names any op targets — used to skip stories that contain none of them. */
  targets: string[];
}

export function defineMigration<TBefore extends SchemaShape, TAfter extends SchemaShape = TBefore>(
  definition: MigrationDefinition<TBefore, TAfter>,
): CompiledMigration {
  const ops: MigrationOp[] = [];

  const fieldHandle = (block: string, field: string, under?: string) => ({
    renameTo: (name: string) =>
      void ops.push({ type: "rename", block, from: field, to: name, under }),
    remove: () => void ops.push({ type: "remove", block, field, under }),
    asString: () => void ops.push({ type: "coerce", block, field, to: "string" as const, under }),
    asNumber: () => void ops.push({ type: "coerce", block, field, to: "number" as const, under }),
    asBoolean: () => void ops.push({ type: "coerce", block, field, to: "boolean" as const, under }),
    moveTo: (name: string) => void ops.push({ type: "move", block, from: field, to: name, under }),
    reorder: (compare: (a: AnyChild, b: AnyChild) => number) =>
      void ops.push({ type: "reorder", block, field, compare, under }),
  });

  const blockHandle = (name: string, under?: string): Record<string, unknown> => ({
    alter: (fn: (block: any) => any) => void ops.push({ type: "alter", block: name, fn, under }),
    field: (field: string) => fieldHandle(name, field, under),
    under: (parent: string) => blockHandle(name, parent),
  });

  const builder = {
    field(path: string) {
      const dot = path.indexOf(".");
      return fieldHandle(path.slice(0, dot), path.slice(dot + 1));
    },
    block: (name: string) => blockHandle(name),
  } as unknown as MigrationBuilder<TBefore, TAfter>;

  definition.up(builder);

  return {
    name: definition.name,
    ops,
    targets: [...new Set(ops.map((op) => op.block))],
  };
}
