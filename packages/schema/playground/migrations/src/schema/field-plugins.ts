import { defineFieldPlugin } from "@storyblok/schema";
import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Value stored by the `native-color-picker` field plugin.
 *
 * UNVERIFIED. This shape is written to the best understanding available here
 * and nothing in this repository grounds it: no source defines the plugin, and
 * pushing content in this shape and reading it back would only prove the API
 * stored what it was sent. Setting the colour by hand in the Storyblok UI and
 * reading the result back is what would settle it.
 */
export type NativeColorPickerValue = {
  value: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Hand-written [Standard Schema](https://standardschema.dev) validator, so the
 * playground adds no runtime dependency to describe one plugin field.
 */
const nativeColorPickerValue: StandardSchemaV1<NativeColorPickerValue> = {
  "~standard": {
    version: 1,
    vendor: "storyblok-playground",
    validate(value) {
      if (isRecord(value) && typeof value.value === "string") {
        return { value: { value: value.value } };
      }
      return { issues: [{ message: "Expected a string `value` property.", path: ["value"] }] };
    },
  },
};

/**
 * Registering the plugin is what keeps `section.accent_color` narrowing to a
 * concrete shape instead of widening back to the untyped plugin value, which is
 * the only plugin-narrowing case this playground has.
 */
export const nativeColorPicker = defineFieldPlugin({
  fieldType: "native-color-picker",
  value: nativeColorPickerValue,
});
