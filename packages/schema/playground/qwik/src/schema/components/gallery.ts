import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { headlineField } from '../fields';

export const galleryBlock = defineBlock({
  name: 'gallery',
  is_nestable: true,
  schema: {
    headline: defineProp(headlineField, { pos: 0 }),
    images: defineProp(
      defineField({
        type: 'multiasset',
        filetypes: ['images'],
        minimum_entries: 1,
        maximum_entries: 12,
      }),
      { pos: 1, required: true },
    ),
    columns: defineProp(
      defineField({
        type: 'number',
        min_value: 1,
        max_value: 4,
        steps: 1,
        decimals: 0,
        default_value: '3',
      }),
      { pos: 2 },
    ),
    show_captions: defineProp(
      defineField({
        type: 'boolean',
        inline_label: true,
        default_value: 'true',
      }),
      { pos: 3 },
    ),
  },
});
