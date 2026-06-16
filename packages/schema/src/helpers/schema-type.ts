import type { Block } from './define-block';
import type { Datasource } from './define-datasource';

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
 * import type { Schema as InferSchema } from '@storyblok/schema';
 *
 * export const schema = {
 *   blocks: { pageBlock, heroBlock },
 *   datasources: { colorsDatasource },
 * };
 *
 * export type Schema = InferSchema<typeof schema>;
 * export type Blocks = Schema['blocks'];
 * export type Datasources = Schema['datasources'];
 * ```
 */
export interface Schema<
  T extends {
    blocks: Record<string, Block>;
    datasources?: Record<string, Datasource>;
  },
> {
  blocks: T['blocks'][keyof T['blocks']];
  datasources: T['datasources'] extends Record<string, Datasource>
    ? T['datasources'][keyof T['datasources']]
    : never;
}
