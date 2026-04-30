import { defineBlock, defineField, defineProp } from '@storyblok/schema';

export const kitchenSinkBlock = defineBlock({
  name: 'kitchen_sink',
  is_nestable: true,
  display_name: 'Kitchen Sink (All Field Types)',
  schema: {
    text_field: defineProp(
      defineField({ type: 'text', max_length: 100 }),
      { pos: 0 },
    ),
    textarea_field: defineProp(
      defineField({ type: 'textarea', max_length: 500 }),
      { pos: 1 },
    ),
    richtext_field: defineProp(
      defineField({
        type: 'richtext',
        customize_toolbar: true,
        toolbar: ['bold', 'italic', 'link'],
      }),
      { pos: 2 },
    ),
    markdown_field: defineProp(
      defineField({
        type: 'markdown',
        rich_markdown: true,
        customize_toolbar: true,
        toolbar: ['bold', 'italic', 'code'],
      }),
      { pos: 3 },
    ),
    number_field: defineProp(
      defineField({
        type: 'number',
        min_value: 0,
        max_value: 9999,
        decimals: 2,
        steps: 0.01,
      }),
      { pos: 4 },
    ),
    boolean_field: defineProp(
      defineField({ type: 'boolean', inline_label: true, default_value: 'false' }),
      { pos: 5 },
    ),
    datetime_field: defineProp(
      defineField({ type: 'datetime' }),
      { pos: 6 },
    ),
    asset_field: defineProp(
      defineField({ type: 'asset', filetypes: ['images'] }),
      { pos: 7 },
    ),
    multiasset_field: defineProp(
      defineField({ type: 'multiasset', filetypes: ['images', 'videos'] }),
      { pos: 8 },
    ),
    multilink_field: defineProp(
      defineField({ type: 'multilink' }),
      { pos: 9 },
    ),
    option_field: defineProp(
      defineField({ type: 'option', source: 'internal', datasource_slug: 'icons' }),
      { pos: 10 },
    ),
    options_field: defineProp(
      defineField({ type: 'options', source: 'internal', datasource_slug: 'icons' }),
      { pos: 11 },
    ),
    bloks_field: defineProp(
      defineField({ type: 'bloks' }),
      { pos: 12 },
    ),
    table_field: defineProp(
      defineField({ type: 'table' }),
      { pos: 13 },
    ),
    settings_section: defineProp(
      defineField({
        type: 'section',
        keys: ['text_field', 'textarea_field'],
        fieldset: { title: 'Text Fields', collapsible: true, collapsed: true },
      }),
      { pos: 14 },
    ),
  },
});
