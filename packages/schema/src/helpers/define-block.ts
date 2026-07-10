import type {
  Block,
  BlockFields,
  NestableBlock,
  RootBlock,
} from '../generated/types/block';
import type { BlockFolder } from './define-folder';
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

/** Accepted input for a block's `folder`: a folder ref, a raw path string, or `null` to explicitly ungroup. */
type FolderInput = BlockFolder | string | null;

/** Normalizes a folder input type to the display path literal it resolves to. */
type NormalizeFolder<T> = T extends { path: infer P extends string } ? P : T;

type BlockInput<
  TName extends string = string,
  TFields extends BlockFields = BlockFields,
  TIsRoot extends boolean = false,
  TIsNestable extends boolean = true,
  TFolder extends FolderInput | undefined = undefined,
> = Prettify<
  Omit<Block, 'name' | 'fields' | 'is_root' | 'is_nestable' | 'folder' | BlockOptional> & {
    name: TName;
    fields: TFields;
    is_root?: TIsRoot;
    is_nestable?: TIsNestable;
    folder?: TFolder;
  } & Partial<Pick<Block, Exclude<BlockOptional, 'is_root' | 'is_nestable'>>>
>;

type DefinedBlock<
  TName extends string,
  TFields extends BlockFields,
  TIsRoot extends boolean,
  TIsNestable extends boolean,
  TFolder extends FolderInput | undefined = undefined,
> = Prettify<
  Omit<Block, 'name' | 'fields' | 'is_root' | 'is_nestable' | 'folder'> & {
    name: TName;
    fields: TFields;
    is_root: TIsRoot;
    is_nestable: TIsNestable;
  } & (TFolder extends undefined ? unknown : { folder: NormalizeFolder<TFolder> })
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
  const TFolder extends FolderInput | undefined = undefined,
>(
  block: BlockInput<TName, TFields, TIsRoot, TIsNestable, TFolder>,
): DefinedBlock<TName, TFields, TIsRoot, TIsNestable, TFolder>;

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

  const { folder, ...restBlock } = block ?? {};
  if (folder !== undefined && typeof restBlock.component_group_uuid === 'string') {
    throw new Error(`defineBlock: block "${block?.name ?? ''}" sets both "folder" and "component_group_uuid"; use one`);
  }
  if (typeof folder === 'string' && !folder.split('/').some(segment => segment.trim() !== '')) {
    throw new Error(`defineBlock: block "${block?.name ?? ''}" has an empty "folder" path`);
  }
  const normalizedFolder = folder === undefined
    ? undefined
    : (folder !== null && typeof folder === 'object' ? folder.path : folder);

  return {
    ...BLOCK_DEFAULTS,
    ...restBlock,
    ...(folder !== undefined && { folder: normalizedFolder }),
    fields,
  };
}
