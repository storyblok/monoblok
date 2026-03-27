import type { Field, FieldType } from '../types/field';
import type { Prop, PropConfig } from '../types/prop';

/**
 * Configures a field as a prop within a component schema.
 *
 * Accepts two forms:
 *
 * **Two-arg form** — pass a pre-defined field (e.g. from `defineField`) plus a
 * separate prop config. Useful when the same field definition is shared across
 * multiple components.
 *
 * **Standalone form** — pass the field config and prop config keys together in
 * one object. Equivalent to calling `defineField` + `defineProp` in one step.
 * The `const` generic preserves literal array values (e.g. `component_whitelist`).
 *
 * @example
 * // Standalone — field and prop config inline
 * const headlineProp = defineProp({ type: 'text', pos: 0, required: true });
 *
 * @example
 * // Standalone with bloks whitelist (literal types preserved)
 * const bodyProp = defineProp({ type: 'bloks', component_whitelist: ['teaser'], pos: 1 });
 *
 * @example
 * // Two-arg — reuse a shared field definition
 * const headlineField = defineField({ type: 'text', max_length: 100 });
 * const headlineProp = defineProp(headlineField, { pos: 1, required: true });
 */
export function defineProp<
  TField extends Field,
  const TPropConfig extends PropConfig,
>(field: TField, config: TPropConfig): Prop<TField, TPropConfig>;

export function defineProp<
  TFieldType extends FieldType,
  const TField extends Extract<Field, { type: TFieldType }> & PropConfig,
>(fieldAndConfig: TField): TField;

export function defineProp(fieldOrCombined: Field & PropConfig, config?: PropConfig): Prop {
  return config !== undefined ? { ...fieldOrCombined, ...config } : fieldOrCombined;
}
