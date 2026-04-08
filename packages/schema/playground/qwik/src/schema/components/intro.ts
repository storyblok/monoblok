import { defineBlock, defineProp } from '@storyblok/schema';

import { eyebrowField, headlineField, markdownField } from '../fields';

export const introBlock = defineBlock({
  name: 'intro',
  is_nestable: true,
  schema: {
    eyebrow: defineProp(eyebrowField, { pos: 0 }),
    headline: defineProp(headlineField, { pos: 1, required: true }),
    body: defineProp(markdownField, { pos: 2 }),
  },
});
