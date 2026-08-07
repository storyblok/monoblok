import { defineBlock, defineField } from '@storyblok/schema';
import { heroBlock } from './hero';
import { featureCardBlock } from './feature-card';
import { kitchenSinkBlock } from './kitchen-sink';

export const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  fields: [
    defineField('title', { type: 'text', max_length: 70 }),
    defineField('seo_title', { type: 'text', max_length: 70 }),
    defineField('seo_description', { type: 'textarea', max_length: 160 }),
    defineField('body', {
      type: 'bloks',
      allow: [heroBlock.name, featureCardBlock.name, kitchenSinkBlock.name],
    }),
  ],
});
