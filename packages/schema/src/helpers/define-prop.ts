import type { Field, FieldType } from './define-field';
import type { Prettify } from '../utils/prettify';

/**
 * Component-level field configuration.
 * These keys exist on the prop but not on the standalone field.
 */
export interface PropConfig {
  pos?: number;
  required?: boolean;
}

/**
 * A field as configured within a component schema.
 * Merges field type + field config + component-level prop config.
 * PropConfig keys override field-level keys (e.g., `required`).
 */
export type Prop<
  TField extends Field = Field,
  TPropConfig extends PropConfig = PropConfig,
> = Prettify<Omit<TField, keyof TPropConfig> & TPropConfig>;

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
 *
 * @example
 * // Standalone — field and prop config inline
 * const headlineProp = defineProp({
 *   type: 'text',
 *   pos: 0,
 *   required: true,
 * });
 *
 * @example
 * // Two-arg — reuse a shared field definition
 * const headlineField = defineField({
 *   type: 'text',
 *   max_length: 100,
 * });
 * const headlineProp = defineProp(headlineField, {
 *   pos: 1,
 *   required: true,
 * });
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
