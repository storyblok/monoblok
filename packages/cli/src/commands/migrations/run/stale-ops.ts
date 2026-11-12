import type { CompiledMigration, MigrationOp } from "@storyblok/schema";
import { coercionBetween } from "@storyblok/schema/internal/codegen";

/** The fields of each block the space holds now, mapped to their field types. */
export type LiveFields = ReadonlyMap<string, ReadonlyMap<string, string | undefined>>;

export type StaleOp = { op: MigrationOp; reason: string };

/**
 * The fields an op creates and the fields it removes, on the block it targets.
 * Ops that only change a value a block already holds create nothing: they skip
 * blocks without the field, so a rerun on migrated content changes nothing,
 * while content that still holds the field reaches a later migration
 * consuming it in the shape that migration expects.
 */
function fieldEffects(op: MigrationOp): { creates: readonly string[]; removes: readonly string[] } {
  switch (op.kind) {
    case "renameField":
    case "moveField":
      return { creates: [op.to], removes: [op.field] };
    case "removeField":
      return { creates: [], removes: [op.field] };
    case "addField":
      return { creates: [op.field], removes: [] };
    case "splitField":
      return { creates: op.into, removes: op.into.includes(op.field) ? [] : [op.field] };
    case "mergeFields":
      return { creates: [op.into], removes: op.fields.filter((field) => field !== op.into) };
    case "fieldsToBlock": {
      const moved = Object.keys(op.into.fields);
      return { creates: [op.field], removes: moved.filter((field) => field !== op.field) };
    }
    default:
      return { creates: [], removes: [] };
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

/**
 * The target of a `renameBlock` while the space still holds the source block
 * but not the target. `schema push` renames the block in place before the
 * migration moves its content, so this means the schema change isn't pushed
 * yet, and the content would end up in a block the space doesn't have.
 */
function missingRenameTarget(op: MigrationOp, live: LiveFields): string | undefined {
  return op.kind === "renameBlock" && live.has(op.block) && !live.has(op.to) ? op.to : undefined;
}

function describeOp(op: MigrationOp): string {
  return "field" in op ? `${op.kind} ${op.block}.${op.field}` : `${op.kind} ${op.block}`;
}

/**
 * Splits off the ops a later schema change superseded: one that creates a field
 * the block no longer has, removes a field the block has again, or coerces a
 * field to a type it no longer has, and a block rename whose target the space
 * doesn't hold. Every migration reruns, so without this an old op would undo
 * the later change, such as adding back a field that was since renamed. The
 * fields of blocks the space does not hold are not checked.
 */
export function withoutStaleOps(
  migration: CompiledMigration,
  live: LiveFields,
): { migration: CompiledMigration; stale: StaleOp[] } {
  const stale: StaleOp[] = [];
  const ops = migration.ops.filter((op) => {
    const renameTarget = missingRenameTarget(op, live);
    if (renameTarget !== undefined) {
      stale.push({
        op,
        reason: `${describeOp(op)} skipped: the space has no ${renameTarget} block. Push the schema that renames it first, unless a later push renamed it again.`,
      });
      return false;
    }
    const fields = live.get(op.block);
    if (!fields) {
      return true;
    }
    const { creates, removes } = fieldEffects(op);
    const missing = creates.find((field) => !fields.has(field));
    const restored = removes.find((field) => fields.has(field));
    const retyped = retypedField(op, fields);
    const prefix = `${describeOp(op)} skipped: the ${op.block} block in the space`;
    if (missing !== undefined) {
      stale.push({
        op,
        reason: `${prefix} has no field "${missing}". Push the schema the migration was written for, unless a later push removed the field.`,
      });
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
