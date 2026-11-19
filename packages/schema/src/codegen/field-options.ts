import * as z from "zod";

import { zComponentSchemaField } from "../generated/overlay/zod.gen";
import { DERIVED_RESTRICTION_KEYS } from "../restrictions";

/**
 * Options nothing reads on a field type that doesn't declare them: the editor
 * keys a field by its schema record key, not by a `key` option, and only the
 * block and link pickers of the field types that declare the restriction keys
 * read them.
 */
const INERT_FIELD_KEYS: ReadonlySet<string> = new Set([
  "key",
  "restrict_type",
  ...DERIVED_RESTRICTION_KEYS,
]);

/**
 * Keys passed on without checking their value: `type` is the discriminant,
 * `name` is stamped by `defineField`, and `toDslField` translates the
 * restriction and datasource keys.
 */
const UNVALIDATED_KEYS: ReadonlySet<string> = new Set([
  "type",
  "name",
  "restrict_type",
  "datasource_slug",
  ...DERIVED_RESTRICTION_KEYS,
]);

/** No field type declares `name`: `defineField` stamps it from its first argument. */
const STAMPED_KEYS: ReadonlySet<string> = new Set(["name"]);

/** Field types whose options are free-form: plugin options pass through verbatim. */
const FREE_FORM_FIELD_TYPES: ReadonlySet<string> = new Set(["custom"]);

/**
 * Boolean options the editor enables only on a literal `true`. Every other
 * boolean option it reads by truthiness.
 */
const STRICT_BOOLEAN_OPTIONS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["boolean", new Set(["default_value"])],
  ["markdown", new Set(["rich_markdown"])],
]);

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
export function getOptionSchemasByFieldType(): Map<string, OptionSchemas> {
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

const NUMERIC_STRING = /^\s*-?\d+(\.\d+)?\s*$/;

const acceptsValue = (schemas: z.core.$ZodType[], value: unknown): boolean =>
  schemas.every((schema) => z.safeParse(schema, value).success);

/** What `partitionFieldOptions` does with a value the option's schema rejects. */
type Resolution = { kind: "keep"; value: unknown } | { kind: "drop" } | { kind: "untyped" };

/**
 * A string value as the editor reads it. Older spaces store numbers and
 * booleans as strings.
 */
function resolveString(
  fieldType: string,
  key: string,
  value: string,
  schemas: z.core.$ZodType[],
): Resolution {
  if (NUMERIC_STRING.test(value) && acceptsValue(schemas, Number(value))) {
    return { kind: "keep", value: Number(value) };
  }
  if (acceptsValue(schemas, true)) {
    const strict = STRICT_BOOLEAN_OPTIONS.get(fieldType)?.has(key) ?? false;
    return value === "" || strict ? { kind: "drop" } : { kind: "keep", value: true };
  }
  return value === "" ? { kind: "drop" } : { kind: "untyped" };
}

/** A field's options, split by what `defineField` accepts for its type. */
export interface PartitionedFieldOptions {
  /** Options the field type owns, as the type wants them. */
  known: Record<string, unknown>;
  /**
   * Options the field type doesn't declare, or values it can't type. They reach
   * the space only through an untyped spread, so `schema push` writes them back.
   */
  unchecked: Record<string, unknown>;
}

/**
 * Splits a wire field's options into the ones its type declares and the rest,
 * so the generated `defineField` call compiles and the editor reads the field
 * the same way after a push.
 *
 * A string where the option wants a number or boolean is converted to the value
 * the editor reads: `maximum: "2"` → `2`; `required: "false"` → `true`, since the
 * editor reads it by truthiness. Dropped, because the editor treats them as
 * unset: `""`, a string in a {@link STRICT_BOOLEAN_OPTIONS} option, and
 * {@link INERT_FIELD_KEYS}.
 *
 * Anything else the type doesn't accept goes to `unchecked`. A field type the
 * spec doesn't know keeps every option as is; a `custom` field keeps its plugin
 * options as is.
 */
export function partitionFieldOptions(field: Record<string, unknown>): PartitionedFieldOptions {
  const fieldType = String(field.type);
  const ownOptions = getOptionSchemasByFieldType().get(fieldType);
  if (!ownOptions) {
    return { known: { ...field }, unchecked: {} };
  }
  const freeForm = FREE_FORM_FIELD_TYPES.has(fieldType);
  const known: Record<string, unknown> = {};
  const unchecked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(field)) {
    const schemas = ownOptions.get(key);
    if (!schemas) {
      if (freeForm || STAMPED_KEYS.has(key)) {
        known[key] = value;
      } else if (!INERT_FIELD_KEYS.has(key)) {
        unchecked[key] = value;
      }
      continue;
    }
    if (UNVALIDATED_KEYS.has(key) || acceptsValue(schemas, value)) {
      known[key] = value;
      continue;
    }
    const resolution: Resolution =
      typeof value === "string"
        ? resolveString(fieldType, key, value, schemas)
        : { kind: "untyped" };
    if (resolution.kind === "keep") {
      known[key] = resolution.value;
    } else if (resolution.kind === "untyped") {
      unchecked[key] = value;
    }
  }
  return { known, unchecked };
}
