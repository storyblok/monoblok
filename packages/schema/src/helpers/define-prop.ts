import type { Field } from '../types/field';
import type { Prop, PropConfig } from '../types/prop';

/**
 * Configures a field as a prop within a component schema.
 * Merges the field definition with component-level configuration (`pos`, `required`, etc.).
 *
 * @example
 * const headlineProp = defineProp(headlineField, { pos: 1, required: true });
 */
export const defineProp = <
  TField extends Field,
  TPropConfig extends PropConfig,
>(
  field: TField,
  config: TPropConfig,
): Prop<TField, TPropConfig> => ({ ...field, ...config });
