import type { Field } from ".";

/**
 * Every field type the Management API accepts on a component schema. Derived from
 * the generated `Field` union so `storyblok types` fails to compile when a new
 * field type arrives without a mapping.
 */
export type ComponentPropertySchemaType = Field["type"];

export interface ComponentPropertySchemaOption {
  _uid: string;
  name: string;
  value: string;
}

export type ComponentPropertySchema = Omit<Field, "type" | "options"> & {
  key: string;
  type: ComponentPropertySchemaType;
  options?: ComponentPropertySchemaOption[];
};
