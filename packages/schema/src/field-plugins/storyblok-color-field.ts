import type { StandardSchemaV1 } from "@standard-schema/spec";
import { defineFieldPlugin } from "../helpers/define-field-plugin";
import { isRecord } from "../utils/is-record";

/**
 * Value stored by Storyblok's official Colorpicker field plugin. The editor
 * writes `plugin: "official-colorpicker"` (not the field type) and stores a
 * cleared color as `""`.
 */
export type StoryblokColorFieldValue = {
  color: string;
  plugin: "official-colorpicker";
};

/**
 * Hand-written [Standard Schema](https://standardschema.dev) validator for
 * {@link StoryblokColorFieldValue}. Implemented directly (no external validator)
 * so the package stays validator-agnostic and adds no runtime dependency.
 */
const storyblokColorFieldValue: StandardSchemaV1<StoryblokColorFieldValue> = {
  "~standard": {
    version: 1,
    vendor: "storyblok-schema",
    validate(value) {
      if (!isRecord(value) || typeof value.color !== "string") {
        return { issues: [{ message: "Expected a string `color` property.", path: ["color"] }] };
      }
      if (value.plugin !== "official-colorpicker") {
        return {
          issues: [
            { message: 'Expected `plugin` to be "official-colorpicker".', path: ["plugin"] },
          ],
        };
      }
      return { value: { color: value.color, plugin: value.plugin } };
    },
  },
};

/**
 * Official Storyblok Colorpicker field plugin (`storyblok-colorpicker`).
 * Register it in a schema's `fieldPlugins` to type matching custom fields.
 */
export const storyblokColorField = defineFieldPlugin({
  fieldType: "storyblok-colorpicker",
  value: storyblokColorFieldValue,
});
