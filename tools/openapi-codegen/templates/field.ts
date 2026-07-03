import type {
  AssetFieldValue,
  BlockContentBase,
  BlockContentInputBase,
  Field,
  MultilinkFieldValue,
  PluginFieldValue,
  RichtextFieldValue,
  TableFieldValue,
} from './_sources';
import type { Prettify } from './_utils';
import type { Block, BlockFields } from './block';

export type { Field };
export type { AssetFieldValue, MultilinkFieldValue, PluginFieldValue, RichtextFieldValue, TableFieldValue };

/**
 * Registry of all blocks in the space, used to resolve nested `bloks` fields.
 * A `Block` union resolves nested content against the registry; `NoBlocks`
 * (the default) leaves it loose (`BlockContentBase`).
 */
type NoBlocks = false;

/** True when `T` is the un-narrowed base `Block` (i.e. no specific block was supplied). */
type IsBaseBlock<T> = [Block] extends [T] ? true : false;

/**
 * Maps a block's ordered `fields` array to its read content object, splitting
 * required (`required: true`) from optional fields. Each `F` is a member of the
 * field union, so it provably satisfies `FieldValue`'s `Field` constraint.
 */
type ContentFields<TFields extends BlockFields, TBlocks> = Prettify<
  { [F in TFields[number] as F extends { required: true } ? F['name'] : never]: FieldValue<F, TBlocks> }
  & { [F in TFields[number] as F extends { required: true } ? never : F['name']]?: FieldValue<F, TBlocks> | null }
>;

/** Input (write) variant of {@link ContentFields}, resolving each field via {@link FieldValueInput}. */
type ContentFieldsInput<TFields extends BlockFields, TBlocks> = Prettify<
  { [F in TFields[number] as F extends { required: true } ? F['name'] : never]: FieldValueInput<F, TBlocks> }
  & { [F in TFields[number] as F extends { required: true } ? never : F['name']]?: FieldValueInput<F, TBlocks> | null }
>;

/**
 * Content object for a single block instance as returned by the Storyblok
 * Content Delivery API. Without a `TBlock` argument, this is the loose
 * runtime shape (any block, `_editable` optional). With a schema-typed
 * `TBlock`, fields are narrowed per the block's `fields`.
 */
export type BlockContent<TBlock extends Block = Block, TBlocks = NoBlocks> =
  IsBaseBlock<TBlock> extends true
    ? BlockContentBase
    // distribute over each member of the `TBlock` union
    : TBlock extends any
      ? Prettify<
        { _uid: string; component: TBlock['name']; _editable?: string }
        & ContentFields<TBlock['fields'], TBlocks>
      >
      : never;

/** Input variant of {@link BlockContent} for write operations (creating/updating stories via the MAPI). `_uid` is optional. */
export type BlockContentInput<TBlock extends Block = Block, TBlocks = NoBlocks> =
  IsBaseBlock<TBlock> extends true
    ? BlockContentInputBase
    // distribute over each member of the `TBlock` union
    : TBlock extends any
      ? Prettify<
        { _uid?: string; component: TBlock['name']; _editable?: string }
        & ContentFieldsInput<TBlock['fields'], TBlocks>
      >
      : never;

export type BlocksFieldValue<
  TBlock extends Block = Block,
  TBlocks = NoBlocks,
> = BlockContent<TBlock, TBlocks>[];

/** Union of all valid Storyblok field type discriminants (e.g., `text`, `bloks`). */
export type FieldType = Field['type'];

interface FieldTypeValueMap {
  text: string;
  textarea: string;
  richtext: RichtextFieldValue;
  markdown: string;
  number: number;
  datetime: string;
  boolean: boolean;
  option: string;
  options: string[];
  asset: AssetFieldValue;
  multiasset: AssetFieldValue[];
  multilink: MultilinkFieldValue;
  bloks: BlockContentBase[];
  table: TableFieldValue;
  section: never;
  tab: never;
  custom: PluginFieldValue;
}

type IsNestable<T> =
  T extends { is_nestable: false } ? false
    : T extends { is_nestable: true } ? true
      : true;

type ApplyAllow<TField, TBlocks> = TField extends { allow: ReadonlyArray<infer TAllowed extends string> }
  // keep only the registry blocks named in `allow`
  ? Extract<TBlocks, { name: TAllowed }>
  // no `allow`: distribute over the registry, keeping nestable blocks
  : TBlocks extends any
    ? IsNestable<TBlocks> extends true ? TBlocks : never
    : never;

/** Resolves a field definition to its runtime content value type (read). */
export type FieldValue<
  TField extends Field = Field,
  TBlocks = NoBlocks,
> = Prettify<
  TField extends { type: 'bloks' }
    // guard `never` first: `[never] extends [Block]` is structurally true, so an
    // empty registry would otherwise be mistaken for a populated one
    ? [TBlocks] extends [never]
        ? BlockContentBase[]
        : [TBlocks] extends [Block]
            ? BlockContent<ApplyAllow<TField, TBlocks>, TBlocks>[]
            : BlockContentBase[]
    : FieldTypeValueMap[TField['type']]
>;

/** Resolves a field definition to its input value type (write). */
export type FieldValueInput<
  TField extends Field = Field,
  TBlocks = NoBlocks,
> = Prettify<
  TField extends { type: 'bloks' }
    // guard `never` first: `[never] extends [Block]` is structurally true, so an
    // empty registry would otherwise be mistaken for a populated one
    ? [TBlocks] extends [never]
        ? BlockContentInputBase[]
        : [TBlocks] extends [Block]
            ? BlockContentInput<ApplyAllow<TField, TBlocks>, TBlocks>[]
            : BlockContentInputBase[]
    : FieldTypeValueMap[TField['type']]
>;
