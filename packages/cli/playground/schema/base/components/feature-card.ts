import { defineBlock, defineField } from '@storyblok/schema';
import { imageField } from '../fields';
import { contentFolder } from './folders/content';
import { wrap } from '../../helpers';

export const featureCardBlock = defineBlock({
  name: 'feature_card',
  is_nestable: true,
  component_group_uuid: contentFolder.uuid,
  preview_field: 'title',
  schema: wrap({
    title: defineField({ type: 'text', max_length: 80, required: true }),
    description: defineField({ type: 'textarea', max_length: 300 }),
    image: imageField,
    icon: defineField({ type: 'option', source: 'internal', datasource_slug: 'icons' }),
    link: defineField({ type: 'multilink' }),
    is_highlighted: defineField({ type: 'boolean', inline_label: true }),
    highlight_color: defineField({
      type: 'text',
      max_length: 7,
      description: 'Hex color code',
      conditional_settings: [{ field: 'is_highlighted', value: true }],
    }),
  }),
});
