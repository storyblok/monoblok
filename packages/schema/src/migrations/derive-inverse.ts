/**
 * The inverse of a migration computed from the op list alone, so a run can be
 * undone where its recorded patches are unavailable. It cannot see edits made
 * since the run, so recorded patches take precedence whenever they exist.
 */
import type { MigrationOp } from "./ops";

export interface UnderivableOp {
  index: number;
  kind: MigrationOp["kind"];
  reason: string;
}

export interface DerivedInverse {
  /** True when every op inverted, so the whole migration can be undone blind. */
  derivable: boolean;
  /**
   * The inverses that could be derived, in reverse order of the forward ops,
   * addressed to the block names the forward migration left behind.
   */
  ops: MigrationOp[];
  blocked: UnderivableOp[];
  /**
   * Ops whose inverse exists but cannot restore the original value — a coercion
   * that narrowed, a move that overwrote, a field added only where it was
   * absent. A CLI should refuse these without an explicit opt-in.
   */
  lossy: number[];
  /**
   * Block names `ops` targets. Differs from the forward migration's `targets`
   * wherever a `renameBlock` changed a name.
   */
  targets: string[];
}

/**
 * The name a block carries after the forward migration ran. Every op addresses
 * a block by its pre-migration name, so only a `renameBlock` of that name moves it.
 */
function renamedBy(ops: readonly MigrationOp[], name: string): string {
  let final = name;
  for (const op of ops) {
    if (op.kind === "renameBlock" && op.block === name) final = op.to;
  }
  return final;
}

function invert(op: MigrationOp, block: string): MigrationOp | string {
  switch (op.kind) {
    case "renameField":
      return { kind: "renameField", block, field: op.to, to: op.field };
    case "moveField":
      return { kind: "moveField", block, field: op.to, to: op.field };
    case "coerceField":
      return op.from === undefined
        ? "no `from` was stated, so the original field type is unknown"
        : { kind: "coerceField", block, field: op.field, to: op.from, from: op.to };
    case "removeField":
      return "the values are gone";
    case "reorderField":
      return "the original order is not recorded";
    case "alterField":
    case "alterBlock":
      return "the output depends on the input, so the closure would have to run backwards";
    case "expandBlock":
      return "the blocks it wrote are known only to the closure that wrote them";
    case "addField":
      return { kind: "removeField", block, field: op.field };
    case "splitField":
      return op.merge === undefined
        ? "no `merge` counterpart was stated, so the parts cannot be put back together"
        : {
            kind: "mergeFields",
            block,
            fields: op.into,
            into: op.field,
            merge: op.merge,
            ...(op.split === undefined ? {} : { split: op.split }),
          };
    case "mergeFields":
      return op.split === undefined
        ? "no `split` counterpart was stated, so the merged value cannot be taken apart"
        : {
            kind: "splitField",
            block,
            field: op.into,
            into: op.fields,
            split: op.split,
            ...(op.merge === undefined ? {} : { merge: op.merge }),
          };
    case "renameBlock":
      return { kind: "renameBlock", block, to: op.block };
    case "wrapChildren":
      return {
        kind: "unwrapChildren",
        block,
        field: op.field,
        unwrap: op.in,
        from: op.into,
      };
    case "unwrapChildren":
      return {
        kind: "wrapChildren",
        block,
        field: op.field,
        in: op.unwrap,
        into: op.from,
      };
  }
}

export function deriveInverse(ops: readonly MigrationOp[]): DerivedInverse {
  const derived: MigrationOp[] = [];
  const blocked: UnderivableOp[] = [];
  const lossy: number[] = [];

  ops.forEach((op, index) => {
    const inverse = invert(op, renamedBy(ops, op.block));
    if (typeof inverse === "string") {
      blocked.push({ index, kind: op.kind, reason: inverse });
      return;
    }
    // A move overwrites its target and a coercion narrows, so replaying the
    // mirror op puts the key back where it was without the value it displaced.
    // A split/merge round trip is lossy either direction: splitting then
    // merging normalizes whatever the merge discards (whitespace, a
    // separator), and merging then splitting cannot recover a separator the
    // merge already threw away.
    // `unwrapChildren` collapses every container it dissolves into one
    // rebuilt wrapper, cannot recall which child came from which, and drops
    // the containers' own fields.
    // `addField` only fills blocks that lacked the field, but its inverse
    // removes the field from every block, values that predate the run included.
    if (
      op.kind === "moveField" ||
      op.kind === "coerceField" ||
      op.kind === "splitField" ||
      op.kind === "mergeFields" ||
      op.kind === "unwrapChildren" ||
      op.kind === "addField"
    ) {
      lossy.push(index);
    }
    derived.push(inverse);
  });

  const reversed = derived.reverse();
  return {
    derivable: blocked.length === 0,
    ops: reversed,
    blocked,
    lossy,
    targets: [...new Set(reversed.map((op) => op.block))],
  };
}
