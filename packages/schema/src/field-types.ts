import type { FieldType, LayoutFieldType } from "./generated/types/field";

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
 * `field-types.test-d.ts` fails the type check if the generated union gains a
 * member this list is missing.
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

/**
 * Field types that only arrange other fields in the editor (tabs, sections and
 * the legacy `group`). They hold no value, so a story never stores anything
 * under their key, and block content types leave their keys out. The editor
 * labels `section` "Group".
 *
 * A runtime counterpart to the type-level `LayoutFieldType`.
 * `field-types.test-d.ts` fails the type check if the two disagree.
 */
export const LAYOUT_FIELD_TYPES = [
  "section",
  "tab",
  "group",
] as const satisfies readonly LayoutFieldType[];

const LAYOUT_FIELD_TYPE_SET: ReadonlySet<string> = new Set(LAYOUT_FIELD_TYPES);

export function isLayoutFieldType(type: string): type is LayoutFieldType {
  return LAYOUT_FIELD_TYPE_SET.has(type);
}
