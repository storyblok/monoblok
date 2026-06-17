import { defineBlock, defineField } from '@storyblok/schema';

import { eyebrowField, headlineField } from '../fields';

export const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  fields: [
    eyebrowField,
    { ...headlineField, required: true },
    defineField('image', { type: 'asset', filetypes: ['images'] }),
  ],
});
