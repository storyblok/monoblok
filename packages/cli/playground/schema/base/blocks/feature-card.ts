import { defineBlock, defineField } from '@storyblok/schema';
import { contentFolder } from './folders/content';

export const featureCardBlock = defineBlock({
  name: 'feature_card',
  is_nestable: true,
  component_group_uuid: contentFolder.uuid,
  preview_field: 'title',
  schema: [
    defineField('title', { type: 'text', max_length: 80, required: true }),
    defineField('description', { type: 'textarea', max_length: 300 }),
    defineField('image', { type: 'asset', filetypes: ['images'] }),
    defineField('icon', { type: 'option', source: 'internal', datasource_slug: 'icons' }),
    defineField('link', { type: 'multilink' }),
    defineField('is_highlighted', { type: 'boolean', inline_label: true }),
    defineField('highlight_color', {
      type: 'text',
      max_length: 7,
      description: 'Hex color code',
      conditional_settings: [{ field: 'is_highlighted', value: true }],
    }),
  ],
});
