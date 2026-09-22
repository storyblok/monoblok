/**
 * SPIKE — prototype quality. Not a shipped API.
 *
 * `defineMigration<After, Before>` under test: a migration is a list of ops —
 * plain objects built by imported factories — not a script and not a chain.
 *
 * Parameter order is `After` first because one type parameter has to mean the
 * schema people actually have. Under the one-parameter shorthand, reads widen
 * to `… | (string & {})`: a surviving name autocompletes, one the schema no
 * longer has still compiles. Naming `Before` — generated as a snapshot next to
 * the migration — tightens reads back to an error.
 *
 * Two call shapes. The bare array is forward-only and is the common case; the
 * object exists so a title and a hand-written inverse have somewhere to live,
 * which is also what makes `up` an honest name. `down` is the last of three
 * inverse sources, not an override: recorded patches still win, since only they
 * can tell that an editor changed the field since.
 *
 * The probes here pass `name` because they share one module and so have no
 * filename to be keyed by; shipped migrations take their id from the filename.
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
  /** Spike only — see the module comment. */
  name?: string;
  up: MigrationOps<TAfter, TBefore>;
  /**
   * A hand-written inverse, for the ops no inverse can be derived from. It is a
   * migration in its own right — read in the other direction, so its schema
   * parameters are swapped — and gets the same idempotency check, since it is
   * the half nobody tests.
   */
  down?: MigrationOps<TBefore, TAfter>;
}

export interface CompiledMigration {
  title?: string;
  name?: string;
  ops: MigrationOp[];
  down?: MigrationOp[];
  /** Block names any op targets — used to skip stories that contain none of them. */
  targets: string[];
}

export function defineMigration<TAfter extends SchemaShape, TBefore extends SchemaShape = TAfter>(
  definition: MigrationOps<TAfter, TBefore> | MigrationDefinition<TAfter, TBefore>,
): CompiledMigration {
  const spec = Array.isArray(definition)
    ? { up: definition as MigrationOps<TAfter, TBefore> }
    : (definition as MigrationDefinition<TAfter, TBefore>);
  const ops = [...spec.up] as MigrationOp[];

  return {
    title: spec.title,
    name: spec.name,
    ops,
    down: spec.down ? ([...spec.down] as MigrationOp[]) : undefined,
    targets: [...new Set(ops.map((op) => op.block))],
  };
}
