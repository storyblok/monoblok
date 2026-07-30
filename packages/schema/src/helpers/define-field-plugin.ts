import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Binds a Storyblok custom field `field_type` to a
 * [Standard Schema](https://standardschema.dev) validator. The validator (`S`,
 * retained on `value`) supplies both the static value type
 * (`StandardSchemaV1.InferOutput<S>`) and a runtime handle, so a single
 * declaration serves types and (future) runtime validation.
 */
export interface FieldPlugin<
  F extends string = string,
  S extends StandardSchemaV1 = StandardSchemaV1,
> {
  fieldType: F;
  value: S;
}

/**
 * Declares a custom field plugin: both the `fieldType` literal and the value
 * type infer from the single argument. `value` accepts any Standard Schema
 * validator (Zod, Valibot, ArkType, or hand-written) and is retained for
 * runtime use. A thin, strongly-typed identity helper — it does not validate.
 *
 * The value type is read from the validator's `~standard.types`, not from what
 * its `validate` returns. A hand-written validator must therefore be annotated
 * (`const v: StandardSchemaV1<Color, Color> = { … }`) or declare `types`
 * explicitly. A bare object literal satisfies the constraint and registers the
 * `fieldType` — so nothing warns — while the field still resolves to the untyped
 * `PluginFieldValue` fallback, which reads as the declaration having no effect.
 *
 * @example
 * const colorPicker = defineFieldPlugin({
 *   fieldType: 'my-custom-color-picker',
 *   value: z.object({ color: z.string(), alpha: z.number() }),
 * });
 */
export function defineFieldPlugin<
  const F extends string,
  S extends StandardSchemaV1,
>(config: { fieldType: F; value: S }): FieldPlugin<F, S> {
  return config;
}
