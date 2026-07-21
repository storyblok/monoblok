import { defineBlock, defineField } from '@storyblok/schema';

export const kitchenSinkBlock = defineBlock({
  name: 'kitchen_sink',
  is_nestable: true,
  display_name: 'Kitchen Sink (All Field Types)',
  fields: [
    defineField('text_field', { type: 'text', max_length: 100 }),
    defineField('textarea_field', { type: 'textarea', max_length: 500 }),
    defineField('richtext_field', {
      type: 'richtext',
      customize_toolbar: true,
      toolbar: ['bold', 'italic', 'link'],
    }),
    defineField('markdown_field', {
      type: 'markdown',
      rich_markdown: true,
      customize_toolbar: true,
      toolbar: ['bold', 'italic', 'code'],
    }),
    defineField('number_field', { type: 'number', min_value: 0, max_value: 9999, decimals: 2, steps: 0.01 }),
    defineField('boolean_field', { type: 'boolean', inline_label: true, default_value: 'false' }),
    defineField('datetime_field', { type: 'datetime' }),
    defineField('asset_field', { type: 'asset', filetypes: ['images'] }),
    defineField('multiasset_field', { type: 'multiasset', filetypes: ['images', 'videos'] }),
    defineField('multilink_field', { type: 'multilink' }),
    defineField('option_field', { type: 'option', source: 'internal', datasource: 'icons' }),
    defineField('options_field', { type: 'options', source: 'internal', datasource: 'icons' }),
    defineField('bloks_field', { type: 'bloks' }),
    defineField('table_field', { type: 'table' }),
    defineField('settings_section', {
      type: 'section',
      keys: ['text_field', 'textarea_field'],
      fieldset: { title: 'Text Fields', collapsible: true, collapsed: true },
    }),
  ],
});
