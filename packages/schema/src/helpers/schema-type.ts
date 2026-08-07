import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { Datasource } from './define-datasource';
import type { FieldPlugin } from './define-field-plugin';
import type { SchemaConfig } from './define-schema';

/**
 * Derives a `fieldType → validator output` map from a `fieldPlugins` record.
 * Record keys are cosmetic labels; the map is keyed by each plugin's
 * `fieldType`. Resolves to `{}` when no plugins are registered.
 */
type FieldPluginMap<TPlugins> = TPlugins extends Record<string, FieldPlugin>
  ? { [K in keyof TPlugins as TPlugins[K]['fieldType']]: StandardSchemaV1.InferOutput<TPlugins[K]['value']> }
  : Record<never, never>;

/**
 * Derives a schema types interface from a schema object.
 *
 * Accepts the `typeof` a schema object whose `blocks` property is a record of
 * `defineBlock()` results, and optionally a `datasources` record, and produces
 * a type with unions of those types. A schema describes content shapes only;
 * component groups are a UI concern and not part of it.
 *
 * @example
 * ```ts
 * import { defineSchema } from '@storyblok/schema';
 * import type { Schema as InferSchema } from '@storyblok/schema';
 *
 * export const schema = defineSchema({
 *   blocks: { pageBlock, heroBlock },
 *   datasources: { colorsDatasource },
 *   fieldPlugins: { storyblokColorField },
 * });
 *
 * export type Schema = InferSchema<typeof schema>;
 * export type Blocks = Schema['blocks'];
 * export type FieldPlugins = Schema['fieldPlugins'];
 * ```
 */
export interface Schema<T extends SchemaConfig> {
  blocks: T['blocks'][keyof T['blocks']];
  datasources: T['datasources'] extends Record<string, Datasource>
    ? T['datasources'][keyof T['datasources']]
    : never;
  fieldPlugins: FieldPluginMap<T['fieldPlugins']>;
}
