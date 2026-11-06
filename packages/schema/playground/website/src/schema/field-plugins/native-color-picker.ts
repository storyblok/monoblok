import { defineFieldPlugin } from "@storyblok/schema";

// Placeholder: accepts any value. Replace `value` with a Standard Schema validator
// (Zod, Valibot, ArkType, or hand-written) for the value this plugin stores.
// Declare `plugin` if the plugin stores it (legacy plugins do).
export const nativeColorPickerFieldPlugin = defineFieldPlugin({
  fieldType: "native-color-picker",
  value: {
    "~standard": {
      version: 1,
      vendor: "storyblok-placeholder",
      validate: (value: unknown) => ({ value }),
    },
  },
});
