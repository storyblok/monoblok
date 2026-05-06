import { defineBlock, defineField } from '@storyblok/schema';

import { headlineField } from '../fields';
import { teaserBlock } from './teaser';

export const teaserListBlock = defineBlock({
  name: 'teaser_list',
  is_nestable: true,
  schema: [
    headlineField,
    defineField('items', {
      type: 'bloks',
      component_whitelist: [teaserBlock.name],
      minimum: 1,
    }),
  ],
});
