import type { StoryblokPropertyType } from "./storyblok";
import type { ComponentSchemaField } from ".";

export type ComponentPropertySchemaType =
  | StoryblokPropertyType
  | "array"
  | "bloks"
  | "boolean"
  | "custom"
  | "datetime"
  | "image"
  | "markdown"
  | "number"
  | "option"
  | "options"
  | "text"
  | "textarea";

export interface ComponentPropertySchemaOption {
  _uid: string;
  name: string;
  value: string;
}

export type ComponentPropertySchema = Omit<ComponentSchemaField, "type" | "options"> & {
  key: string;
  type: ComponentPropertySchemaType;
  options?: ComponentPropertySchemaOption[];
};
