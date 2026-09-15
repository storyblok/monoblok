import type { FieldType } from "./generated/types/field";

/**
 * Every field type the Management API accepts on a component schema, in the
 * order the generated `Field` union declares them.
 *
 * A runtime counterpart to the type-level {@link FieldType}, which is derived
 * from that union and so has no value form. `validateSchema` needs the values:
 * `defineField` already rejects an unknown `type` at compile time, but a schema
 * authored in plain JavaScript, assembled at runtime, or read back from a space
 * reaches the validator with no compiler in the way.
 *
 * `satisfies` keeps every entry a real field type, and the equality assertion in
 * `field-types.test-d.ts` fails the type check if the generated union gains a
 * member this list is missing, so the two cannot drift apart unnoticed.
 */
export const FIELD_TYPES = [
  "text",
  "textarea",
  "richtext",
  "markdown",
  "number",
  "datetime",
  "boolean",
  "option",
  "options",
  "asset",
  "multiasset",
  "image",
  "file",
  "multilink",
  "link",
  "bloks",
  "table",
  "section",
  "tab",
  "group",
  "commerce",
  "custom",
] as const satisfies readonly FieldType[];
