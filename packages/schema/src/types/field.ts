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

/**
 * All valid Storyblok field type discriminants.
 * Derived from the generated ComponentSchemaField union.
 */
export type FieldType = ComponentSchemaField['type'];

/**
 * Maps each field type discriminant to its generated config shape.
 * Derived entirely from the generated types — no manual authoring.
 */
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

/**
 * Maps each field type discriminant to its runtime content value shape.
 * Manually authored — this domain knowledge (config type → value type)
 * is not expressible in the OpenAPI spec.
 */
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

/**
 * A single field variant for a specific field type.
 * Directly aliases the generated config type for that discriminant.
 */
export type FieldVariant<TFieldType extends FieldType> = FieldTypeConfigMap[TFieldType];

/**
 * Resolves the runtime content value type for a given field config.
 *
 * For most field types this is a straight lookup in `FieldTypeValueMap`.
 * For `bloks` fields that carry a `component_whitelist` with literal string
 * elements, the value type is narrowed:
 * - When `TSchema` (the parent schema union) is provided, each whitelisted name
 *   is matched against the schema union to produce a proper `StoryContent<T>`
 *   discriminated union — giving full field-level typing on nested bloks.
 * - When `TSchema` is not provided (`never`), falls back to a minimal
 *   `{ component: TName; _uid: string; [key: string]: unknown }` shape.
 *
 * `TSchema` is a forward reference to `Component` (from `./component`) resolved
 * at call-site to avoid a circular import between `field.ts` and `story.ts`.
 *
 * @example
 * // bloks field without whitelist → StoryContentGenerated[]
 * type V1 = FieldValue<{ type: 'bloks' }>;
 *
 * @example
 * // bloks field with whitelist, no schema → minimal narrowed array
 * type V2 = FieldValue<{ type: 'bloks'; component_whitelist: readonly ['teaser'] }>;
 * // V2 = Array<{ component: 'teaser'; _uid: string; [key: string]: unknown }>
 *
 * @example
 * // bloks field with whitelist + schema → fully typed StoryContent union array
 * type V3 = FieldValue<
 *   { type: 'bloks'; component_whitelist: readonly ['teaser'] },
 *   typeof teaserComponent | typeof heroComponent
 * >;
 * // V3 = Array<StoryContent<typeof teaserComponent>>  (hero filtered out)
 */
export type FieldValue<
  TFieldConfig,
  TSchema = never,
> =
  TFieldConfig extends { type: 'bloks'; component_whitelist: ReadonlyArray<infer TName extends string> }
    ? [TSchema] extends [never]
        // No schema provided — fall back to a minimal narrowed shape
        ? Array<{ component: TName; _uid: string; [key: string]: unknown }>
        // Filter TSchema to whitelisted members and distribute over StoryContent.
        // The inline expansion avoids a circular import from field.ts → story.ts.
        : Array<TSchema extends { name: TName; schema: infer S } ? Prettify<{ component: TName; _uid?: string } & { [K in keyof S]: FieldValue<S[K], TSchema> }> : never>
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
