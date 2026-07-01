import type { Block } from './define-block';
import type { Datasource } from './define-datasource';
import type { FieldPlugin } from './define-field-plugin';

/** Minimal shape accepted by {@link defineSchema}; extra keys pass through unchanged. */
interface SchemaConfig {
  blocks: Record<string, Block>;
  datasources?: Record<string, Datasource>;
  fieldPlugins?: Record<string, FieldPlugin>;
}

/**
 * Typed identity wrapper for a schema object, consistent with the other
 * `define*` helpers. Preserves the exact literal shape via `const` inference so
 * {@link Schema} can derive block, datasource, and field-plugin types from
 * `typeof schema`. Does not validate or transform.
 *
 * @example
 * export const schema = defineSchema({
 *   blocks: { pageBlock, heroBlock },
 *   datasources: { colorsDatasource },
 *   fieldPlugins: { colorPicker },
 * });
 */
export function defineSchema<const T extends SchemaConfig>(schema: T): T {
  return schema;
}
