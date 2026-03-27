import type { Field } from './field';
import type { Prettify } from './utils';

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
