import { defineFieldPlugin } from "@storyblok/schema";

/** The value type a `colorpicker` custom field should resolve to. */
export interface ColorPickerValue {
  hex: string;
}

/**
 * Minimal shape of a [Standard Schema](https://standardschema.dev) validator,
 * hand-rolled so this fixture needs no validator dependency (no zod, valibot,
 * …). `defineFieldPlugin` accepts any Standard Schema, and nothing here
 * validates at runtime, only the output type is used.
 */
interface MinimalStandardSchema<Output> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => { readonly value: Output };
    readonly types?: { readonly input: unknown; readonly output: Output };
  };
}

const colorPickerSchema: MinimalStandardSchema<ColorPickerValue> = {
  "~standard": {
    version: 1,
    vendor: "fixture",
    validate: () => ({ value: { hex: "#000000" } }),
    // Standard Schema's own convention: `types` exists only for static
    // inference (`StandardSchemaV1.InferOutput`) and is never read at
    // runtime, so real implementations (zod, valibot, …) assign it the same
    // way, a phantom cast rather than a constructed value.
    types: undefined as unknown as { input: unknown; output: ColorPickerValue },
  },
};

/** Registers `colorpicker` as the custom field used by `page.accent` in `components.ts`. */
export const fieldPlugins = {
  colorPicker: defineFieldPlugin({
    fieldType: "colorpicker",
    value: colorPickerSchema,
  }),
};
