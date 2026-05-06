import { defineBlock, defineField } from '@storyblok/schema';

import { headlineField } from '../fields';

export const galleryBlock = defineBlock({
  name: 'gallery',
  is_nestable: true,
  schema: [
    headlineField,
    defineField('images', {
      type: 'multiasset',
      filetypes: ['images'],
      minimum_entries: 1,
      maximum_entries: 12,
      required: true,
    }),
    defineField('columns', {
      type: 'number',
      min_value: 1,
      max_value: 4,
      steps: 1,
      decimals: 0,
      default_value: '3',
    }),
    defineField('show_captions', {
      type: 'boolean',
      inline_label: true,
      default_value: 'true',
    }),
  ],
});
