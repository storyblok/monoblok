import type { ComponentCreate, Component as ComponentGenerated, ComponentUpdate } from '../generated/mapi/types.gen';
import type { ComponentSchemaField as Field } from '../generated/overlay/types.gen';
import type { Prettify } from '../utils/prettify';

export type { ComponentCreate, ComponentUpdate };

const BLOCK_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
  is_root: false,
  is_nestable: true,
  component_group_uuid: null,
};

/** Input form: an ordered array of named fields. The array index becomes `pos`. */
export type BlockSchemaInput = ReadonlyArray<Field & { name: string; required?: boolean }>;

/** Wire form: the MAPI object map keyed by field name. This is what `defineBlock` returns. */
export type BlockSchema = Record<string, Field & { required?: boolean }>;

/** Converts an array-form schema input into the wire-shape object map at the type level. */
export type SchemaArrayToRecord<T extends BlockSchemaInput> = {
  [F in T[number] as F['name']]: Omit<F, 'name'>;
};

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
  TInputSchema extends BlockSchemaInput = BlockSchemaInput,
  TIsRoot extends boolean = false,
  TIsNestable extends boolean = true,
  TComponentGroupUuid extends string | null = null,
> = Prettify<
  Omit<ComponentGenerated, 'name' | 'schema' | 'is_root' | 'is_nestable' | 'component_group_uuid' | BlockOptional> & {
    name: TName;
    schema: TInputSchema;
    is_root?: TIsRoot;
    is_nestable?: TIsNestable;
    component_group_uuid?: TComponentGroupUuid;
  } & Partial<Pick<ComponentGenerated, Exclude<BlockOptional, 'is_root' | 'is_nestable' | 'component_group_uuid'>>>
>;

type DefinedBlock<
  TName extends string,
  TBlockSchema,
  TIsRoot extends boolean,
  TIsNestable extends boolean,
  TComponentGroupUuid extends string | null,
> = Prettify<
  Omit<ComponentGenerated, 'name' | 'schema' | 'is_root' | 'is_nestable' | 'component_group_uuid'> & {
    name: TName;
    schema: TBlockSchema;
    is_root: TIsRoot;
    is_nestable: TIsNestable;
    component_group_uuid: TComponentGroupUuid;
  }
>;

/**
 * Returns a {@link Block} with object-shape `schema` (matches the MAPI wire
 * shape). The user-facing input is an ordered array of `defineField` calls;
 * the array index becomes the field's `pos` in the returned map. Throws if
 * two fields share the same `name`.
 *
 * @example
 * const pageBlock = defineBlock({
 *   name: 'page',
 *   is_root: true,
 *   schema: [
 *     defineField('headline', { type: 'text', required: true }),
 *   ],
 * });
 */
export function defineBlock<
  TName extends string,
  const TInputSchema extends BlockSchemaInput,
  TIsRoot extends boolean = false,
  TIsNestable extends boolean = true,
  TComponentGroupUuid extends string | null = null,
>(
  block: BlockInput<TName, TInputSchema, TIsRoot, TIsNestable, TComponentGroupUuid>,
): DefinedBlock<TName, SchemaArrayToRecord<TInputSchema>, TIsRoot, TIsNestable, TComponentGroupUuid>;

export function defineBlock(block: any) {
  const inputSchema = Array.isArray(block?.schema) ? block.schema : [];
  const seen = new Set<string>();
  const schemaRecord: Record<string, unknown> = {};
  inputSchema.forEach((field: any, index: number) => {
    const name = field?.name;
    if (typeof name !== 'string') {
      return;
    }
    if (seen.has(name)) {
      throw new Error(`defineBlock: duplicate field name "${name}" in block "${block?.name ?? ''}"`);
    }
    seen.add(name);
    const { name: _name, ...rest } = field;
    schemaRecord[name] = { ...rest, pos: index };
  });
  return { ...BLOCK_DEFAULTS, ...block, schema: schemaRecord };
}

/**
 * Defines a block creation payload for the MAPI.
 *
 * @example
 * const payload = defineBlockCreate({ name: 'page', schema: { ... } });
 */
export const defineBlockCreate = (block: ComponentCreate): ComponentCreate => block;

/**
 * Defines a block update payload for the MAPI.
 *
 * @example
 * const payload = defineBlockUpdate({ display_name: 'Page' });
 */
export const defineBlockUpdate = (block: ComponentUpdate): ComponentUpdate => block;
