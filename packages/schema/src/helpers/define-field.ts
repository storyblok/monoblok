import type {
  ComponentSchemaField as Field,
} from '../generated/mapi-types';
import type {
  AssetFieldValue,
  BlokContent as BlokContentGenerated,
  MultilinkFieldValue,
  PluginFieldValue,
  RichtextFieldValue,
  TableFieldValue,
} from '../generated/types';
import type { Block } from './define-block';
import type { Prettify } from '../utils/prettify';

export { Field };

/** Loose variant of the generated `BlokContent` with `_uid` optional — used as the fallback for write operations when no block union is provided. */
type BlokContentLoose = {
  _uid?: string;
  component: string;
  _editable?: string | undefined;
} & {
  [key: string]:
    | string
    | number
    | boolean
    | Array<string | AssetFieldValue | BlokContentLoose>
    | AssetFieldValue
    | MultilinkFieldValue
    | TableFieldValue
    | RichtextFieldValue
    | PluginFieldValue
    | undefined;
};

/** Keys in a schema record that have `required: true`. */
type RequiredFieldKeys<T> = {
  [K in keyof T]: T[K] extends { required: true } ? K : never
}[keyof T];

/** Keys in a schema record that do NOT have `required: true`. */
type OptionalFieldKeys<T> = Exclude<keyof T, RequiredFieldKeys<T>>;

/**
 * Builds the content object for a single block instance as returned by the
 * Storyblok Content Delivery API. Includes `_uid` (always present in API
 * responses) and respects required/optional field semantics.
 *
 * For write operations (creating/updating stories), use {@link BlockContentInput}
 * instead, which omits `_uid` since Storyblok generates it automatically.
 */
export type BlockContent<TBlock extends Block = Block, TBlocks = false> = TBlock extends any
  ? { _uid: string; component: TBlock['name'] }
  & {
    [K in RequiredFieldKeys<TBlock['schema']>]: FieldValue<NonNullable<TBlock['schema'][K]>, TBlocks>
  }
  & {
    [K in OptionalFieldKeys<TBlock['schema']>]?: FieldValue<NonNullable<TBlock['schema'][K]>, TBlocks> | null
  }
  : never;

/**
 * Input variant of {@link BlockContent} for write operations (creating/updating
 * stories via the MAPI). `_uid` is optional — Storyblok generates it
 * automatically when omitted. Nested bloks fields also use this input variant
 * so that deeply nested blocks do not require `_uid` either.
 */
export type BlockContentInput<TBlock extends Block = Block, TBlocks = false> = TBlock extends any
  ? { _uid?: string; component: TBlock['name'] }
  & {
    [K in RequiredFieldKeys<TBlock['schema']>]: FieldValueInput<NonNullable<TBlock['schema'][K]>, TBlocks>
  }
  & {
    [K in OptionalFieldKeys<TBlock['schema']>]?: FieldValueInput<NonNullable<TBlock['schema'][K]>, TBlocks> | null
  }
  : never;

export type BlocksFieldValue<
  TBlock extends Block = Block,
  TBlocks = false,
> = BlockContent<TBlock, TBlocks>[];

export type { AssetFieldValue, MultilinkFieldValue, PluginFieldValue, RichtextFieldValue, TableFieldValue };

/** Union of all valid Storyblok field type discriminants (e.g., `text`, `bloks`). */
export type FieldType = Field['type'];

/** Maps each field type discriminant to its runtime content value type. */
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
  bloks: BlokContentGenerated[];
  table: TableFieldValue;
  section: never;
  tab: never;
  custom: PluginFieldValue;
}

/**
 * Checks whether a block is nestable, defaulting to `true` when
 * `is_nestable` is absent or undefined.
 */
type IsNestable<T> =
  T extends { is_nestable: false } ? false
    : T extends { is_nestable: true } ? true
      : true; // default: nestable when is_nestable is not specified

type ApplyWhitelist<TField, TBlocks> = TField extends { component_whitelist: ReadonlyArray<infer TWhitelisted extends string> }
  // With whitelist: filter by block name (distributive over TBlocks)
  ? TBlocks extends { name: TWhitelisted } ? TBlocks : never
  // No whitelist: filter by nestability (distributive over TBlocks)
  : TBlocks extends any
    ? IsNestable<TBlocks> extends true ? TBlocks : never
    : never;

/** Resolves a field definition to its runtime content value type (read). */
export type FieldValue<
  TField extends Field = Field,
  TBlocks = false,
> = Prettify<
  TField extends { type: 'bloks' }
    // Bloks field — guard against `never` first (it satisfies `[never] extends [X]`
    // for all X, which would incorrectly enter the typed path with empty results).
    ? [TBlocks] extends [never]
        ? BlokContentGenerated[]
        : [TBlocks] extends [Block]
            ? BlockContent<ApplyWhitelist<TField, TBlocks>, TBlocks>[]
            : BlokContentGenerated[]
    // No bloks field
    : FieldTypeValueMap[TField['type']]
>;

/** Resolves a field definition to its input value type (write). Nested bloks use {@link BlockContentInput}. */
export type FieldValueInput<
  TField extends Field = Field,
  TBlocks = false,
> = Prettify<
  TField extends { type: 'bloks' }
    ? [TBlocks] extends [never]
        ? BlokContentLoose[]
        : [TBlocks] extends [Block]
            ? BlockContentInput<ApplyWhitelist<TField, TBlocks>, TBlocks>[]
            : BlokContentLoose[]
    : FieldTypeValueMap[TField['type']]
>;

/**
 * Returns a full {@link Field}.
 *
 * @example
 * const bloks = defineField({
 *   type: 'bloks',
 *   component_whitelist: ['teaser', 'hero'],
 * });
 */
export const defineField = <
  const TField extends Field,
>(
  field: TField,
): TField => field;
