import { defineBlock, defineField } from '@storyblok/schema';
import { wrap } from '../../helpers';

export const kitchenSinkBlock = defineBlock({
  name: 'kitchen_sink',
  is_nestable: true,
  display_name: 'Kitchen Sink (All Field Types)',

  schema: wrap({
    text_field: defineField({ type: 'text', max_length: 100 }),
    textarea_field: defineField({ type: 'textarea', max_length: 500 }),
    richtext_field: defineField({
      type: 'richtext',
      customize_toolbar: true,
      toolbar: ['bold', 'italic', 'link'],
    }),
    markdown_field: defineField({
      type: 'markdown',
      rich_markdown: true,
      customize_toolbar: true,
      toolbar: ['bold', 'italic', 'code'],
    }),
    number_field: defineField({
      type: 'number',
      min_value: 0,
      max_value: 9999,
      decimals: 2,
      steps: 0.01,
    }),
    boolean_field: defineField({ type: 'boolean', inline_label: true, default_value: 'false' }),
    datetime_field: defineField({ type: 'datetime' }),
    asset_field: defineField({ type: 'asset', filetypes: ['images'] }),
    multiasset_field: defineField({ type: 'multiasset', filetypes: ['images', 'videos'] }),
    multilink_field: defineField({ type: 'multilink' }),
    option_field: defineField({ type: 'option', source: 'internal', datasource_slug: 'icons' }),
    options_field: defineField({ type: 'options', source: 'internal', datasource_slug: 'icons' }),
    bloks_field: defineField({ type: 'bloks' }),
    table_field: defineField({ type: 'table' }),
    settings_section: defineField({
      type: 'section',
      keys: ['text_field', 'textarea_field'],
      fieldset: { title: 'Text Fields', collapsible: true, collapsed: true },
    }),
  }),
});
