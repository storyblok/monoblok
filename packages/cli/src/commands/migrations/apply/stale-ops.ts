import type { CompiledMigration, MigrationOp } from "@storyblok/schema/migrations";
import { coercionBetween } from "@storyblok/schema/internal/codegen";

/** The fields of each block the space holds now, mapped to their field types. */
export type LiveFields = ReadonlyMap<string, ReadonlyMap<string, string | undefined>>;

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
      return { writes: op.into, removes: op.into.includes(op.field) ? [] : [op.field] };
    case "mergeFields":
      return { writes: [op.into], removes: op.fields.filter((field) => field !== op.into) };
    default:
      return { writes: [], removes: [] };
  }
}

/**
 * A `coerceField` whose target no longer matches the field's type in the space,
 * such as a text → number conversion after the field was changed back to text.
 */
function retypedField(
  op: MigrationOp,
  fields: ReadonlyMap<string, string | undefined>,
): { field: string; type: string } | undefined {
  if (op.kind !== "coerceField") {
    return undefined;
  }
  const type = fields.get(op.field);
  if (type === undefined || coercionBetween(type, type)?.to === op.to) {
    return undefined;
  }
  return { field: op.field, type };
}

function describeOp(op: MigrationOp): string {
  return "field" in op ? `${op.kind} ${op.block}.${op.field}` : `${op.kind} ${op.block}`;
}

/**
 * Splits off the ops a later schema change superseded: one that writes a field
 * the block no longer has, removes a field the block has again, or coerces a
 * field to a type it no longer has. Every migration reruns, so without this an
 * old op would undo the later change, such as adding back a field that was
 * since renamed. Blocks the space does not hold are not checked.
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
    const retyped = retypedField(op, fields);
    const prefix = `${describeOp(op)} skipped: the ${op.block} block in the space`;
    if (missing !== undefined) {
      stale.push({ op, reason: `${prefix} has no field "${missing}".` });
    } else if (restored !== undefined) {
      stale.push({ op, reason: `${prefix} has the field "${restored}" again.` });
    } else if (retyped !== undefined) {
      stale.push({ op, reason: `${prefix} has "${retyped.field}" as a ${retyped.type} field.` });
    } else {
      return true;
    }
    return false;
  });
  return {
    migration: { ...migration, ops, targets: [...new Set(ops.map((op) => op.block))] },
    stale,
  };
}
