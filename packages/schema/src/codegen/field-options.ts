import * as z from "zod";

import { zComponentSchemaField } from "../generated/overlay/zod.gen";
import { DERIVED_RESTRICTION_KEYS } from "../restrictions";

/**
 * Keys a space stores on a field that no field type owns and nothing reads. The
 * editor keys a field by its schema record key; a `key` option inside the field
 * is a leftover of older tooling and is ignored by the editor and the API alike.
 */
const INERT_FIELD_KEYS: ReadonlySet<string> = new Set(["key"]);

/**
 * Keys passed on without checking their value: `type` is the discriminant,
 * `name` is stamped by `defineField`, and the restriction and datasource keys are
 * translated to their DSL form by the serializer, which has its own rules for them.
 */
const UNVALIDATED_KEYS: ReadonlySet<string> = new Set([
  "type",
  "name",
  "restrict_type",
  "datasource_slug",
  ...DERIVED_RESTRICTION_KEYS,
]);

/** Keys every field carries even though no field type declares them in its options. */
const UNOWNED_STAMPED_KEYS: ReadonlySet<string> = new Set(["type", "name"]);

/** Field types whose options are free-form: plugin options pass through verbatim. */
const FREE_FORM_FIELD_TYPES: ReadonlySet<string> = new Set(["custom"]);

type OptionSchemas = Map<string, z.core.$ZodType[]>;

function collectOptionSchemas(schema: z.core.$ZodType, into: OptionSchemas): void {
  if (schema instanceof z.core.$ZodIntersection) {
    collectOptionSchemas(schema._zod.def.left, into);
    collectOptionSchemas(schema._zod.def.right, into);
    return;
  }
  if (schema instanceof z.core.$ZodObject) {
    for (const [key, option] of Object.entries(schema._zod.def.shape)) {
      into.set(key, [...(into.get(key) ?? []), option]);
    }
  }
}

function fieldTypeOf(options: OptionSchemas): string | undefined {
  for (const schema of options.get("type") ?? []) {
    if (schema instanceof z.core.$ZodEnum) {
      return Object.values(schema._zod.def.entries).map(String)[0];
    }
  }
  return undefined;
}

let optionSchemasByFieldType: Map<string, OptionSchemas> | undefined;

/** The options each field type owns, with their value schemas, read from the field spec. */
function getOptionSchemasByFieldType(): Map<string, OptionSchemas> {
  if (!optionSchemasByFieldType) {
    optionSchemasByFieldType = new Map();
    for (const variant of zComponentSchemaField.options) {
      const options: OptionSchemas = new Map();
      collectOptionSchemas(variant, options);
      const fieldType = fieldTypeOf(options);
      if (fieldType) {
        optionSchemasByFieldType.set(fieldType, options);
      }
    }
  }
  return optionSchemasByFieldType;
}

function isOwnedByAnyFieldType(key: string): boolean {
  for (const options of getOptionSchemasByFieldType().values()) {
    if (options.has(key)) {
      return true;
    }
  }
  return false;
}

const NUMERIC_STRING = /^\s*-?\d+(\.\d+)?\s*$/;

/**
 * The same value in the primitive type the option wants. The editor's number
 * inputs used to persist their raw string, so older spaces hold `"2"` where the
 * schema form now writes `2`.
 */
function coercionCandidates(value: unknown): unknown[] {
  if (typeof value !== "string") {
    return [];
  }
  const candidates: unknown[] = [];
  if (NUMERIC_STRING.test(value)) {
    candidates.push(Number(value));
  }
  if (value === "true" || value === "false") {
    candidates.push(value === "true");
  }
  return candidates;
}

const acceptsValue = (schemas: z.core.$ZodType[], value: unknown): boolean =>
  schemas.every((schema) => z.safeParse(schema, value).success);

/** A field's options, split by what `defineField` accepts for its type. */
export interface PartitionedFieldOptions {
  /** Options the field type owns, with numeric and boolean strings coerced to the type it wants. */
  known: Record<string, unknown>;
  /**
   * Options the field type does not declare, or values it cannot type. They reach
   * the space only through an untyped spread, so `schema push` writes them back.
   */
  unchecked: Record<string, unknown>;
}

/**
 * Splits a wire field's options into the ones its type declares and the ones it
 * does not, so the generated `defineField` call compiles without losing data the
 * editor reads.
 *
 * Dropped, because nothing reads them and push writes the field as a whole, so
 * the space loses only dead keys:
 * - an option another field type owns, left behind when the field's type was
 *   changed (`filetypes` on a `bloks`, `toolbar` on a `text`, `use_uuid` on a
 *   `boolean`, …). The editor's schema form and content handling for a field type
 *   read only that type's own options;
 * - an empty string where the option wants a number or boolean: the editor treats
 *   both `""` and an absent option as unset;
 * - {@link INERT_FIELD_KEYS}.
 *
 * Coerced: a numeric or boolean string where the option wants a number or
 * boolean (`maximum: "2"` → `2`).
 *
 * Anything else the type does not accept goes to `unchecked` rather than being
 * guessed at or dropped. A `custom` field and a field type the spec does not know
 * keep every option as is.
 */
export function partitionFieldOptions(field: Record<string, unknown>): PartitionedFieldOptions {
  const fieldType = String(field.type);
  const ownOptions = getOptionSchemasByFieldType().get(fieldType);
  if (!ownOptions || FREE_FORM_FIELD_TYPES.has(fieldType)) {
    return { known: { ...field }, unchecked: {} };
  }
  const known: Record<string, unknown> = {};
  const unchecked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(field)) {
    const schemas = ownOptions.get(key);
    if (!schemas) {
      if (UNOWNED_STAMPED_KEYS.has(key)) {
        known[key] = value;
      } else if (!INERT_FIELD_KEYS.has(key) && !isOwnedByAnyFieldType(key)) {
        unchecked[key] = value;
      }
      continue;
    }
    if (UNVALIDATED_KEYS.has(key) || acceptsValue(schemas, value)) {
      known[key] = value;
      continue;
    }
    const coerced = coercionCandidates(value).find((candidate) => acceptsValue(schemas, candidate));
    if (coerced !== undefined) {
      known[key] = coerced;
    } else if (value !== "") {
      unchecked[key] = value;
    }
  }
  return { known, unchecked };
}
