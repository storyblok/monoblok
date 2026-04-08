import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { headlineField } from '../fields';
import { teaserBlock } from './teaser';

export const teaserListBlock = defineBlock({
  name: 'teaser_list',
  is_nestable: true,
  schema: {
    headline: defineProp(headlineField, { pos: 0 }),
    items: defineProp(
      defineField({
        type: 'bloks',
        component_whitelist: [teaserBlock.name],
        minimum: 1,
      }),
      { pos: 1 },
    ),
  },
});
