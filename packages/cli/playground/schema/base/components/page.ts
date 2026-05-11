import { defineBlock, defineField } from '@storyblok/schema';
import { heroBlock } from './hero';
import { featureCardBlock } from './feature-card';
import { kitchenSinkBlock } from './kitchen-sink';
import { wrap } from '../../helpers';

export const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: wrap({
    title: defineField({ type: 'text', max_length: 70 }),
    seo_title: defineField({ type: 'text', max_length: 70 }),
    seo_description: defineField({ type: 'textarea', max_length: 160 }),
    body: defineField({
      type: 'bloks',
      component_whitelist: [
        heroBlock.name,
        featureCardBlock.name,
        kitchenSinkBlock.name,
      ],
    }),
  }),
});
