/**
 * Not exported from the package root. Whether content migrations belong in
 * `@storyblok/schema` at all is open — see the prototype design doc; the
 * subpath export exists so this can move without breaking a consumer's import.
 *
 * Tier 2 of rollback: the inverse of a migration computed from the op list
 * alone. No run, no recorded state, no I/O — so a migration whose ops are all
 * derivable rolls back on a machine that never applied it, which is the case
 * recorded patches cannot cover (CI applied it, you want it gone locally).
 *
 * This tier exists only because `up` is data. A script, or a chain that has
 * already executed, would have to be replayed through a recorder first — and a
 * recorder's output is an op list, which is the authoring surface itself.
 *
 * It is blind by construction: it cannot see that an editor changed the field
 * since, so recorded patches take precedence whenever they exist.
 */
import type { MigrationOp } from "./ops";

export interface UnderivableOp {
  index: number;
  kind: MigrationOp["kind"];
  reason: string;
}

export interface DerivedInverse {
  /** True when every op inverted, so the whole migration can be rolled back blind. */
  derivable: boolean;
  /** The inverses that could be derived, in reverse order of the forward ops. */
  ops: MigrationOp[];
  blocked: UnderivableOp[];
  /**
   * Ops whose inverse exists but cannot restore the original value — a coercion
   * that narrowed, a move that overwrote. A CLI should refuse these without an
   * explicit opt-in.
   */
  lossy: number[];
}

function invert(op: MigrationOp): MigrationOp | string {
  switch (op.kind) {
    case "renameField":
      return { kind: "renameField", block: op.block, field: op.to, to: op.field };
    case "moveField":
      return { kind: "moveField", block: op.block, field: op.to, to: op.field };
    case "coerceField":
      return op.from === undefined
        ? "no `from` was stated, so the original field type is unknown"
        : { kind: "coerceField", block: op.block, field: op.field, to: op.from, from: op.to };
    case "removeField":
      return "the values are gone";
    case "reorderField":
      return "the original order is not recorded";
    case "alterField":
    case "alterBlock":
      return "the output depends on the input, so the closure would have to run backwards";
    case "addField":
      // Not lossy: removing a key the migration itself introduced restores
      // exactly what was there.
      return { kind: "removeField", block: op.block, field: op.field };
  }
}

export function deriveInverse(ops: readonly MigrationOp[]): DerivedInverse {
  const derived: MigrationOp[] = [];
  const blocked: UnderivableOp[] = [];
  const lossy: number[] = [];

  ops.forEach((op, index) => {
    const inverse = invert(op);
    if (typeof inverse === "string") {
      blocked.push({ index, kind: op.kind, reason: inverse });
      return;
    }
    // A move overwrites its target and a coercion narrows, so replaying the
    // mirror op puts the key back where it was without the value it displaced.
    if (op.kind === "moveField" || op.kind === "coerceField") lossy.push(index);
    derived.push(inverse);
  });

  return { derivable: blocked.length === 0, ops: derived.reverse(), blocked, lossy };
}
