import type {
  Block,
  BlockFields,
  NestableBlock,
  RootBlock,
} from '../generated/types/block';
import type { Prettify } from '../utils/prettify';

export type { Block, BlockFields, NestableBlock, RootBlock };

const BLOCK_DEFAULTS = {
  id: 1,
  created_at: '',
  updated_at: '',
  is_root: false,
  is_nestable: true,
};

/** Fields that have safe defaults and may be omitted from block input. */
type BlockOptional = keyof typeof BLOCK_DEFAULTS;

type BlockInput<
  TName extends string = string,
  TFields extends BlockFields = BlockFields,
  TIsRoot extends boolean = false,
  TIsNestable extends boolean = true,
> = Prettify<
  Omit<Block, 'name' | 'fields' | 'is_root' | 'is_nestable' | BlockOptional> & {
    name: TName;
    fields: TFields;
    is_root?: TIsRoot;
    is_nestable?: TIsNestable;
  } & Partial<Pick<Block, Exclude<BlockOptional, 'is_root' | 'is_nestable'>>>
>;

type DefinedBlock<
  TName extends string,
  TFields extends BlockFields,
  TIsRoot extends boolean,
  TIsNestable extends boolean,
> = Prettify<
  Omit<Block, 'name' | 'fields' | 'is_root' | 'is_nestable'> & {
    name: TName;
    fields: TFields;
    is_root: TIsRoot;
    is_nestable: TIsNestable;
  }
>;

/**
 * Returns a {@link Block} content-shape definition. The user-facing input is an
 * ordered array of `defineField` calls under `fields`; the array index becomes
 * each field's `pos`. A thin, strongly-typed helper — it does not map to the
 * MAPI wire shape (the CLI owns the DSL→wire mapping). Throws only on duplicate
 * field names (a programming error).
 *
 * @example
 * const pageBlock = defineBlock({
 *   name: 'page',
 *   is_root: true,
 *   fields: [
 *     defineField('headline', { type: 'text', required: true }),
 *   ],
 * });
 */
export function defineBlock<
  TName extends string,
  const TFields extends BlockFields,
  TIsRoot extends boolean = false,
  TIsNestable extends boolean = true,
>(
  block: BlockInput<TName, TFields, TIsRoot, TIsNestable>,
): DefinedBlock<TName, TFields, TIsRoot, TIsNestable>;

export function defineBlock(block: any) {
  const inputFields = Array.isArray(block?.fields) ? block.fields : [];
  const seen = new Set<string>();
  const fields = inputFields.map((field: any, index: number) => {
    const name = field?.name;
    if (typeof name === 'string') {
      if (seen.has(name)) {
        throw new Error(`defineBlock: duplicate field name "${name}" in block "${block?.name ?? ''}"`);
      }
      seen.add(name);
    }
    return { ...field, pos: index };
  });
  return { ...BLOCK_DEFAULTS, ...block, fields };
}
