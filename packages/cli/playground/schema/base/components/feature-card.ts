import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { imageField } from '../fields';
import { contentFolder } from './folders/content';

export const featureCardBlock = defineBlock({
  name: 'feature_card',
  is_nestable: true,
  component_group_uuid: contentFolder.uuid,
  preview_field: 'title',
  schema: {
    title: defineProp(
      defineField({ type: 'text', max_length: 80 }),
      { pos: 0, required: true },
    ),
    description: defineProp(
      defineField({ type: 'textarea', max_length: 300 }),
      { pos: 1 },
    ),
    image: defineProp(imageField, { pos: 2 }),
    icon: defineProp(
      defineField({ type: 'option', source: 'internal', datasource_slug: 'icons' }),
      { pos: 3 },
    ),
    link: defineProp(
      defineField({ type: 'multilink' }),
      { pos: 4 },
    ),
    is_highlighted: defineProp(
      defineField({ type: 'boolean', inline_label: true }),
      { pos: 5 },
    ),
    highlight_color: defineProp(
      defineField({
        type: 'text',
        max_length: 7,
        description: 'Hex color code',
        conditional_settings: [{ field: 'is_highlighted', value: true }],
      }),
      { pos: 6 },
    ),
  },
});
