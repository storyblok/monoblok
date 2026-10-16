import type { CompiledMigration, MigrationOp } from "@storyblok/schema/migrations";

/** The field names of each block the space holds now. */
export type LiveFields = ReadonlyMap<string, ReadonlySet<string>>;

export type StaleOp = { op: MigrationOp; reason: string };

/** The fields an op writes and the fields it removes, on the block it targets. */
function fieldEffects(op: MigrationOp): { writes: readonly string[]; removes: readonly string[] } {
  switch (op.kind) {
    case "renameField":
    case "moveField":
      return { writes: [op.to], removes: [op.field] };
    case "removeField":
      return { writes: [], removes: [op.field] };
    case "addField":
    case "alterField":
    case "coerceField":
    case "reorderField":
      return { writes: [op.field], removes: [] };
    case "splitField":
      return { writes: op.into, removes: [] };
    case "mergeFields":
      return { writes: [op.into], removes: [] };
    default:
      return { writes: [], removes: [] };
  }
}

function describeOp(op: MigrationOp): string {
  return "field" in op ? `${op.kind} ${op.block}.${op.field}` : `${op.kind} ${op.block}`;
}

/**
 * Splits off the ops a later schema change superseded: one that writes a field
 * the block no longer has, or removes a field the block has again. Every
 * migration reruns, so without this an old op would undo the later change,
 * such as adding back a field that was since renamed. Blocks the space does not
 * hold are not checked.
 */
export function withoutStaleOps(
  migration: CompiledMigration,
  live: LiveFields,
): { migration: CompiledMigration; stale: StaleOp[] } {
  const stale: StaleOp[] = [];
  const ops = migration.ops.filter((op) => {
    const fields = live.get(op.block);
    if (!fields) {
      return true;
    }
    const { writes, removes } = fieldEffects(op);
    const missing = writes.find((field) => !fields.has(field));
    const restored = removes.find((field) => fields.has(field));
    if (missing === undefined && restored === undefined) {
      return true;
    }
    stale.push({
      op,
      reason:
        missing === undefined
          ? `${describeOp(op)} skipped: the ${op.block} block in the space has the field "${restored}" again.`
          : `${describeOp(op)} skipped: the ${op.block} block in the space has no field "${missing}".`,
    });
    return false;
  });
  return {
    migration: { ...migration, ops, targets: [...new Set(ops.map((op) => op.block))] },
    stale,
  };
}
