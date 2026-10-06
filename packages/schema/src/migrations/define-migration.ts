/**
 * Not exported from the package root. Whether content migrations belong in
 * `@storyblok/schema` at all is open — see the prototype design doc; the
 * subpath export exists so this can move without breaking a consumer's import.
 *
 * `defineMigration<After, Before>`: a migration is a list of ops — plain
 * objects built by imported factories — not a script and not a chain.
 *
 * Parameter order is `After` first because one type parameter has to mean the
 * schema people actually have. Under the one-parameter shorthand, reads widen
 * to `… | (string & {})`: a surviving name autocompletes, one the schema no
 * longer has still compiles. Naming `Before` — generated as a snapshot next to
 * the migration — tightens reads back to an error.
 *
 * Two call shapes. The bare array is the common case; the object exists so a
 * title has somewhere to live. There is no `down`: an inverse is recorded from
 * the run or derived from the ops, never authored, so a hand-written one could
 * only disagree with what actually happened.
 */
import type { MigrationOp, MigrationOpOf } from "./ops";
import type { SchemaShape } from "./types";

export type { AlterFieldContext, AnyChild, MigrationOp } from "./ops";

/** An op list as authored. The element type is what the factories infer against. */
export type MigrationOps<
  TAfter extends SchemaShape,
  TBefore extends SchemaShape,
> = readonly MigrationOpOf<TAfter, TBefore>[];

export interface MigrationDefinition<TAfter extends SchemaShape, TBefore extends SchemaShape> {
  /** CLI output only; identity stays with the filename. */
  title?: string;
  /**
   * An explicit id, for a migration that has no filename to be keyed by —
   * several declared in one module, say. Shipped migrations take their id from
   * the filename instead.
   */
  name?: string;
  ops: MigrationOps<TAfter, TBefore>;
}

export interface CompiledMigration {
  title?: string;
  name?: string;
  ops: MigrationOp[];
  /** Block names any op targets — used to skip stories that contain none of them. */
  targets: string[];
}

export function defineMigration<TAfter extends SchemaShape, TBefore extends SchemaShape = TAfter>(
  definition: MigrationOps<TAfter, TBefore> | MigrationDefinition<TAfter, TBefore>,
): CompiledMigration {
  const spec = Array.isArray(definition)
    ? { ops: definition as MigrationOps<TAfter, TBefore> }
    : (definition as MigrationDefinition<TAfter, TBefore>);
  const ops = [...spec.ops] as MigrationOp[];

  return {
    title: spec.title,
    name: spec.name,
    ops,
    targets: [...new Set(ops.map((op) => op.block))],
  };
}
