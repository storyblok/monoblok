import type {
  asset_field_config,
  asset_field as AssetField,
  bloks_field_config,
  boolean_field_config,
  ComponentSchemaField,
  custom_field_config,
  datetime_field_config,
  markdown_field_config,
  multiasset_field_config,
  multilink_field_config,
  multilink_field as MultilinkField,
  number_field_config,
  option_field_config,
  options_field_config,
  plugin_field as PluginField,
  richtext_field_config,
  richtext_field as RichtextField,
  section_field_config,
  story_content as StoryContentGenerated,
  tab_field_config,
  table_field_config,
  table_field as TableField,
  text_field_config,
  textarea_field_config,
} from '../generated/types';

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
  text: text_field_config;
  textarea: textarea_field_config;
  richtext: richtext_field_config;
  markdown: markdown_field_config;
  number: number_field_config;
  datetime: datetime_field_config;
  boolean: boolean_field_config;
  option: option_field_config;
  options: options_field_config;
  asset: asset_field_config;
  multiasset: multiasset_field_config;
  multilink: multilink_field_config;
  bloks: bloks_field_config;
  table: table_field_config;
  section: section_field_config;
  tab: tab_field_config;
  custom: custom_field_config;
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
 * The main field type. Discriminated on `type`.
 * When used with a specific type (e.g., `Field<'text'>`), produces a narrowed type.
 * When used with the default (full `FieldType` union), produces the full discriminated union.
 */
export type Field<TFieldType extends FieldType = FieldType> =
  TFieldType extends FieldType
    ? FieldVariant<TFieldType>
    : never;
