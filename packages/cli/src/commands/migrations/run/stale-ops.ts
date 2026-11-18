import type { CompiledMigration, MigrationOp } from "@storyblok/schema";
import { coercionBetween } from "@storyblok/schema/internal/codegen";

/** The fields of each block the space holds now, mapped to their field types. */
export type LiveFields = ReadonlyMap<string, ReadonlyMap<string, string | undefined>>;

export type StaleOp = { op: MigrationOp; reason: string };

/**
 * The fields an op creates and the fields it reads its values from, on the
 * block it targets; a source the op doesn't create again is gone after it.
 * Ops that only change a value a block already holds create nothing: they skip
 * blocks without the field, so a rerun on migrated content changes nothing,
 * while content that still holds the field reaches a later migration
 * consuming it in the shape that migration expects.
 */
function fieldEffects(op: MigrationOp): { creates: readonly string[]; sources: readonly string[] } {
  switch (op.kind) {
    case "renameField":
    case "moveField":
      return { creates: [op.to], sources: [op.field] };
    case "removeField":
      return { creates: [], sources: [op.field] };
    case "addField":
      return { creates: [op.field], sources: [] };
    case "splitField":
      return { creates: op.into, sources: [op.field] };
    case "mergeFields":
      return { creates: [op.into], sources: op.fields };
    case "fieldsToBlock":
      return { creates: [op.into.field], sources: Object.keys(op.fields) };
    default:
      return { creates: [], sources: [] };
  }
}

/** Turns the fields a block holds after `op` into the fields it holds before. */
function undoEffects(op: MigrationOp, fields: Map<string, string | undefined>): void {
  const { creates, sources } = fieldEffects(op);
  // A renamed field keeps its type; any other source's type before the op is unknown.
  const sourceType =
    op.kind === "renameField" || op.kind === "moveField" ? fields.get(op.to) : undefined;
  for (const field of creates) fields.delete(field);
  for (const field of sources) fields.set(field, sourceType);
  if (op.kind === "coerceField") fields.set(op.field, undefined);
}

/**
 * A `coerceField` whose target no longer matches the field's type in the space,
 * such as a text → number conversion after the field was changed back to text.
 * A field type `coerceField` has no target for, such as option, is left to the
 * op, which converts any field.
 */
function retypedField(
  op: MigrationOp,
  fields: ReadonlyMap<string, string | undefined>,
): { field: string; type: string } | undefined {
  if (op.kind !== "coerceField") {
    return undefined;
  }
  const type = fields.get(op.field);
  const stored = type === undefined ? undefined : coercionBetween(type, type)?.to;
  if (type === undefined || stored === undefined || stored === op.to) {
    return undefined;
  }
  return { field: op.field, type };
}

function describeOp(op: MigrationOp): string {
  return "field" in op ? `${op.kind} ${op.block}.${op.field}` : `${op.kind} ${op.block}`;
}

/** Why `op` is stale, given the fields its block holds right after it. */
function staleReason(
  op: MigrationOp,
  fields: ReadonlyMap<string, string | undefined>,
): string | undefined {
  const { creates, sources } = fieldEffects(op);
  const missing = creates.find((field) => !fields.has(field));
  const restored = sources.find((field) => !creates.includes(field) && fields.has(field));
  const retyped = retypedField(op, fields);
  const prefix = `${describeOp(op)} skipped: the ${op.block} block in the space`;
  if (missing !== undefined) {
    return `${prefix} has no field "${missing}". Push the schema the migration was written for, unless a later push removed the field.`;
  }
  if (restored !== undefined) {
    return `${prefix} has the field "${restored}" again.`;
  }
  if (retyped !== undefined) {
    return `${prefix} has "${retyped.field}" as a ${retyped.type} field.`;
  }
  return undefined;
}

/**
 * Splits off the ops a later schema change superseded: one that creates a field
 * the block no longer has, removes a field the block has again, or coerces a
 * field to a type it no longer has. Every migration reruns, so without this an
 * old op would undo the later change, such as adding back a field that was
 * since renamed. The fields of blocks the space does not hold are not checked.
 *
 * Each op is checked against the fields its block holds right after it: the
 * space's fields with the effects of the migration's later ops undone, so a
 * field a later op consumes, such as one renamed only to be moved into a new
 * block, still counts.
 */
export function withoutStaleOps(
  migration: CompiledMigration,
  live: LiveFields,
): { migration: CompiledMigration; stale: StaleOp[] } {
  const after = new Map([...live].map(([block, fields]) => [block, new Map(fields)]));
  const staleOps = new Map<MigrationOp, string>();
  for (const op of [...migration.ops].reverse()) {
    const fields = after.get(op.block);
    if (!fields) {
      continue;
    }
    const reason = staleReason(op, fields);
    if (reason === undefined) {
      undoEffects(op, fields);
    } else {
      staleOps.set(op, reason);
    }
  }
  const ops = migration.ops.filter((op) => !staleOps.has(op));
  return {
    migration: { ...migration, ops, targets: [...new Set(ops.map((op) => op.block))] },
    stale: migration.ops.flatMap((op) => {
      const reason = staleOps.get(op);
      return reason === undefined ? [] : [{ op, reason }];
    }),
  };
}
