import type { Component as ComponentGenerated } from '../generated/mapi-types';
import type { Prettify } from '../utils/prettify';

const BLOCK_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
  is_root: false,
  is_nestable: true,
  component_group_uuid: null,
};

export type BlockSchema = ComponentGenerated['schema'];

/**
 * A Storyblok block.
 */
export type Block<
  TName extends string = string,
  TBlockSchema extends BlockSchema = BlockSchema,
  TIsRoot extends boolean = boolean,
  TIsNestable extends boolean = boolean,
  TComponentGroupUuid extends string | null = string | null,
> = Prettify<
  Omit<ComponentGenerated, 'name' | 'schema' | 'is_root' | 'is_nestable' | 'component_group_uuid'> & {
    name: TName;
    schema: TBlockSchema;
    is_root?: TIsRoot;
    is_nestable?: TIsNestable;
    component_group_uuid?: TComponentGroupUuid;
  }
>;

/** Extract only root blocks from a schema union. */
export type RootBlocks<T extends Block> =
  T extends { is_root: true } ? T : never;

/** Extract only nestable blocks from a schema union. */
export type NestableBlocks<T extends Block> =
  T extends { is_nestable: true } ? T : never;

/** Fields that have safe defaults and may be omitted from block input. */
type BlockOptional = keyof typeof BLOCK_DEFAULTS;

type BlockInput<
  TName extends string = string,
  TBlockSchema extends BlockSchema = BlockSchema,
  TIsRoot extends boolean = false,
  TIsNestable extends boolean = true,
  TComponentGroupUuid extends string | null = null,
> = Prettify<
  Omit<Block<TName, TBlockSchema, TIsRoot, TIsNestable, TComponentGroupUuid>, BlockOptional>
  & Partial<Pick<Block<TName, TBlockSchema, TIsRoot, TIsNestable, TComponentGroupUuid>, BlockOptional>>
>;

type DefinedBlock<
  TName extends string = string,
  TBlockSchema extends BlockSchema = BlockSchema,
  TIsRoot extends boolean = boolean,
  TIsNestable extends boolean = boolean,
  TComponentGroupUuid extends string | null = string | null,
> = Prettify<
  Omit<Block<TName, TBlockSchema, TIsRoot, TIsNestable, TComponentGroupUuid>, 'is_root' | 'is_nestable' | 'component_group_uuid'> & {
    is_root: TIsRoot;
    is_nestable: TIsNestable;
    component_group_uuid: TComponentGroupUuid;
  }
>;

/**
 * Returns a full {@link Block} with all fields populated. API-assigned
 * fields are optional and default to safe values.
 *
 * @example
 * const pageBlock = defineBlock({
 *   name: 'page',
 *   is_root: true,
 *   schema: {
 *     headline: defineProp(headlineField, { pos: 1 }),
 *   },
 * });
 */
// Overload: provides strict generic types so callers get full
// type inference for block name, schema, is_root, and is_nestable.
export function defineBlock<
  TName extends string,
  TBlockSchema extends BlockSchema,
  TIsRoot extends boolean = false,
  TIsNestable extends boolean = true,
  TComponentGroupUuid extends string | null = null,
>(
  block: BlockInput<TName, TBlockSchema, TIsRoot, TIsNestable, TComponentGroupUuid>,
): DefinedBlock<TName, TBlockSchema, TIsRoot, TIsNestable, TComponentGroupUuid>;

// Implementation signature: uses a loose parameter type because
// TypeScript requires the implementation signature to be assignable
// to all overloads. Not visible to callers.
export function defineBlock(block: any) {
  return { ...BLOCK_DEFAULTS, ...block };
}
