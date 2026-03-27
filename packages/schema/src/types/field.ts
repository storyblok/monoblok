import type {
  AssetFieldConfig,
  BloksFieldConfig,
  BooleanFieldConfig,
  ComponentSchemaField,
  CustomFieldConfig,
  DatetimeFieldConfig,
  MarkdownFieldConfig,
  MultiassetFieldConfig,
  MultilinkFieldConfig,
  NumberFieldConfig,
  OptionFieldConfig,
  OptionsFieldConfig,
  RichtextFieldConfig,
  SectionFieldConfig,
  TabFieldConfig,
  TableFieldConfig,
  TextareaFieldConfig,
  TextFieldConfig,
} from '../generated/mapi-types';
import type {
  AssetField,
  MultilinkField,
  PluginField,
  RichtextField,
  StoryContent as StoryContentGenerated,
  TableField,
} from '../generated/types';
import type { Prettify } from './utils';

export type { AssetField, MultilinkField, PluginField, RichtextField, TableField };

/** Union of all valid Storyblok field type discriminants (e.g., `'text'`, `'bloks'`). */
export type FieldType = ComponentSchemaField['type'];

/** Maps each field type discriminant to its configuration shape. */
export interface FieldTypeConfigMap {
  text: TextFieldConfig;
  textarea: TextareaFieldConfig;
  richtext: RichtextFieldConfig;
  markdown: MarkdownFieldConfig;
  number: NumberFieldConfig;
  datetime: DatetimeFieldConfig;
  boolean: BooleanFieldConfig;
  option: OptionFieldConfig;
  options: OptionsFieldConfig;
  asset: AssetFieldConfig;
  multiasset: MultiassetFieldConfig;
  multilink: MultilinkFieldConfig;
  bloks: BloksFieldConfig;
  table: TableFieldConfig;
  section: SectionFieldConfig;
  tab: TabFieldConfig;
  custom: CustomFieldConfig;
}

/** Maps each field type discriminant to its runtime content value type. */
export interface FieldTypeValueMap {
  text: string;
  textarea: string;
  richtext: RichtextField;
  markdown: string;
  number: number;
  datetime: string;
  boolean: boolean;
  option: string;
  options: string[];
  asset: AssetField;
  multiasset: AssetField[];
  multilink: MultilinkField;
  bloks: StoryContentGenerated[];
  table: TableField;
  section: never;
  tab: never;
  custom: PluginField;
}

/** The configuration type for a specific field type discriminant. */
export type FieldVariant<TFieldType extends FieldType> = FieldTypeConfigMap[TFieldType];

/**
 * Resolves the runtime content value type for a given field config.
 *
 * For most field types this is a straight lookup in `FieldTypeValueMap`.
 * For `bloks` fields the value type is narrowed using the `TSchema` and/or
 * the `component_whitelist`:
 *
 * - **With whitelist + schema**: filters schema to whitelisted names and
 *   produces a fully typed `StoryContent` discriminated union array.
 * - **With whitelist, no schema**: falls back to
 *   `Array<{ component: TName; _uid: string; [key: string]: unknown }>`.
 * - **Without whitelist + schema**: falls back to all schema components as a
 *   discriminated union array (i.e. same as having all names whitelisted).
 * - **Without whitelist, no schema**: falls back to `StoryContentGenerated[]`.
 *
 * @example
 * // bloks field without whitelist, no schema → StoryContentGenerated[]
 * type V1 = FieldValue<{ type: 'bloks' }>;
 *
 * @example
 * // bloks field without whitelist + schema → discriminated union of all schema components
 * type V2 = FieldValue<{ type: 'bloks' }, typeof pageComponent | typeof heroComponent>;
 * // V2 = Array<StoryContent<typeof pageComponent> | StoryContent<typeof heroComponent>>
 *
 * @example
 * // bloks field with whitelist, no schema → minimal narrowed array
 * type V3 = FieldValue<{ type: 'bloks'; component_whitelist: readonly ['teaser'] }>;
 * // V3 = Array<{ component: 'teaser'; _uid: string; [key: string]: unknown }>
 *
 * @example
 * // bloks field with whitelist + schema → fully typed StoryContent union array
 * type V4 = FieldValue<
 *   { type: 'bloks'; component_whitelist: readonly ['teaser'] },
 *   typeof teaserComponent | typeof heroComponent
 * >;
 * // V4 = Array<StoryContent<typeof teaserComponent>>  (hero filtered out)
 */
export type FieldValue<
  TFieldConfig,
  TSchema = never,
> =
  TFieldConfig extends { type: 'bloks'; component_whitelist: ReadonlyArray<infer TName extends string> }
    ? [TSchema] extends [never]
        // Whitelist present, no schema — fall back to a minimal narrowed shape
        ? Array<{ component: TName; _uid: string; [key: string]: unknown }>
        // Whitelist present + schema — filter TSchema to whitelisted members.
        // Uses a mapped type instead of a distributive conditional so that:
        //   1. `component` is the specific member's name (proper discriminated union)
        //   2. Recursive FieldValue calls receive the full `TSchema` union, not the
        //      distributed single member — essential for 3+ level nested bloks.
        : Array<{
          [T in TSchema & { name: string; schema: Record<string, unknown> } as T['name'] extends TName ? T['name'] : never]:
          Prettify<{ component: T['name']; _uid?: string } & { [K in keyof T['schema']]: FieldValue<T['schema'][K], TSchema> }>
        } extends infer M ? M[keyof M & string] : never>
    : TFieldConfig extends { type: 'bloks' }
      ? [TSchema] extends [never]
          // No whitelist, no schema — broad generated fallback
          ? FieldTypeValueMap['bloks']
          // No whitelist + schema — include all schema components.
          // Same mapped-type approach to preserve full TSchema in recursive calls.
          : Array<{
            [T in TSchema & { name: string; schema: Record<string, unknown> } as T['name']]:
            Prettify<{ component: T['name']; _uid?: string } & { [K in keyof T['schema']]: FieldValue<T['schema'][K], TSchema> }>
          } extends infer M ? M[keyof M & string] : never>
      : TFieldConfig extends { type: infer T extends FieldType }
        ? FieldTypeValueMap[T]
        : never;

/**
 * The main field type. Discriminated on `type`.
 * When used with a specific type (e.g., `Field<'text'>`), produces a narrowed type.
 * When used with the default (full `FieldType` union), produces the full discriminated union.
 */
export type Field<TFieldType extends FieldType = FieldType> =
  TFieldType extends FieldType
    ? FieldVariant<TFieldType>
    : never;
