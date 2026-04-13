import type { Block } from './define-block';
import type { Datasource } from './define-datasource';
import type { ComponentFolder } from '../mapi/helpers/define-block-folder';

/**
 * Derives a schema types interface from a schema object.
 *
 * Accepts the `typeof` a schema object whose `blocks` property is a
 * record of `defineBlock()` results, and optionally `blockFolders`
 * and `datasources` records, and produces a type with unions of those types.
 *
 * @example
 * ```ts
 * import type { Schema as InferSchema } from '@storyblok/schema';
 *
 * export const schema = {
 *   blocks: { pageBlock, heroBlock },
 *   blockFolders: { layoutFolder },
 *   datasources: { colorsDatasource },
 * };
 *
 * export type Schema = InferSchema<typeof schema>;
 * export type Blocks = Schema['blocks'];
 * export type BlockFolders = Schema['blockFolders'];
 * export type Datasources = Schema['datasources'];
 * ```
 */
export interface Schema<
  T extends {
    blocks: Record<string, Block>;
    blockFolders?: Record<string, ComponentFolder>;
    datasources?: Record<string, Datasource>;
  },
> {
  blocks: T['blocks'][keyof T['blocks']];
  blockFolders: T['blockFolders'] extends Record<string, ComponentFolder>
    ? T['blockFolders'][keyof T['blockFolders']]
    : never;
  datasources: T['datasources'] extends Record<string, Datasource>
    ? T['datasources'][keyof T['datasources']]
    : never;
}
