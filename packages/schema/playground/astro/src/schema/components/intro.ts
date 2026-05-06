import { defineBlock } from '@storyblok/schema';

import { eyebrowField, headlineField, markdownField } from '../fields';

export const introBlock = defineBlock({
  name: 'intro',
  is_nestable: true,
  schema: [
    eyebrowField,
    { ...headlineField, required: true },
    markdownField,
  ],
});
