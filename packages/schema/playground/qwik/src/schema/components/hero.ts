import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { eyebrowField, headlineField } from '../fields';

export const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  schema: {
    eyebrow: defineProp(eyebrowField, { pos: 0 }),
    headline: defineProp(headlineField, { pos: 1, required: true }),
    image: defineProp(defineField({ type: 'asset', filetypes: ['images'] }), { pos: 2 }),
  },
});
