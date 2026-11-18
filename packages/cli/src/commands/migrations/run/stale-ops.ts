import type { CoercionTarget, CompiledMigration, MigrationOp } from "@storyblok/schema";
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

/** What a field of `type` stores, for the types `coerceField` converts to. */
function storedValue(type: string | undefined): CoercionTarget | undefined {
  return type === undefined ? undefined : coercionBetween(type, type)?.to;
}

function fitsStoredValue(value: unknown, stored: CoercionTarget): boolean {
  if (value === null) return true;
  if (stored === "boolean") return typeof value === "boolean";
  // A number field stores its value as a string.
  if (stored === "number") return typeof value === "number" || typeof value === "string";
  return typeof value === "string";
}

/**
 * The value an `addField` backfills every block with, when its callback takes
 * no arguments and so can't depend on the block.
 */
function constantBackfill(op: MigrationOp): { value: unknown } | undefined {
  if (op.kind !== "addField" || op.fn.length > 0) return undefined;
  try {
    const value: unknown = Reflect.apply(op.fn, undefined, []);
    return value === undefined ? undefined : { value };
  } catch {
    return undefined;
  }
}

/**
 * An op that writes a value the field's type in the space no longer stores,
 * such as a text → number coercion after the field was changed back to text,
 * or a boolean backfill of a field added back as text. A field type the check
 * knows no stored value for, such as option, is left to the op.
 */
function retypedField(
  op: MigrationOp,
  fields: ReadonlyMap<string, string | undefined>,
): { field: string; type: string } | undefined {
  if (op.kind !== "coerceField" && op.kind !== "addField") {
    return undefined;
  }
  const type = fields.get(op.field);
  const stored = storedValue(type);
  if (type === undefined || stored === undefined) {
    return undefined;
  }
  const backfill = constantBackfill(op);
  const fits =
    op.kind === "coerceField"
      ? op.to === stored
      : backfill === undefined || fitsStoredValue(backfill.value, stored);
  return fits ? undefined : { field: op.field, type };
}

function describeOp(op: MigrationOp): string {
  return "field" in op ? `${op.kind} ${op.block}.${op.field}` : `${op.kind} ${op.block}`;
}

function skippedPrefix(op: MigrationOp): string {
  return `${describeOp(op)} skipped: the ${op.block} block in the space`;
}

function retypedReason(op: MigrationOp, { field, type }: { field: string; type: string }): string {
  return `${skippedPrefix(op)} has "${field}" as a ${type} field.`;
}

/** Why `op` is stale, given the fields its block holds right after it. */
function staleReason(
  op: MigrationOp,
  fields: ReadonlyMap<string, string | undefined>,
): { reason: string; retyped?: { field: string; type: string } } | undefined {
  const { creates, sources } = fieldEffects(op);
  const missing = creates.find((field) => !fields.has(field));
  const restored = sources.find((field) => !creates.includes(field) && fields.has(field));
  const retyped = retypedField(op, fields);
  if (missing !== undefined) {
    return {
      reason: `${skippedPrefix(op)} has no field "${missing}". Push the schema the migration was written for, unless a later push removed the field.`,
    };
  }
  if (restored !== undefined) {
    return { reason: `${skippedPrefix(op)} has the field "${restored}" again.` };
  }
  if (retyped !== undefined) {
    return { reason: retypedReason(op, retyped), retyped };
  }
  return undefined;
}

/** Ops that write a field's value, and so are written for its type. */
const VALUE_WRITING_KINDS = new Set(["addField", "alterField", "coerceField"]);

/**
 * Splits off the ops a later schema change superseded: one that creates a field
 * the block no longer has, removes a field the block has again, or writes a
 * value the field's type no longer stores. Every migration reruns, so without this an
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
  /** Fields an op was skipped for writing a value their type no longer stores, by `block.field`. */
  const retypedFields = new Map<string, { field: string; type: string }>();
  for (const op of [...migration.ops].reverse()) {
    const fields = after.get(op.block);
    if (!fields) {
      continue;
    }
    const stale = staleReason(op, fields);
    if (stale === undefined) {
      undoEffects(op, fields);
      continue;
    }
    staleOps.set(op, stale.reason);
    if (stale.retyped) retypedFields.set(`${op.block}.${stale.retyped.field}`, stale.retyped);
  }
  // The ops of a migration that write one field were written for the same
  // type, such as the backfill and the fill of a field made required.
  for (const op of migration.ops) {
    const retyped =
      "field" in op && VALUE_WRITING_KINDS.has(op.kind)
        ? retypedFields.get(`${op.block}.${op.field}`)
        : undefined;
    if (retyped && !staleOps.has(op)) staleOps.set(op, retypedReason(op, retyped));
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
