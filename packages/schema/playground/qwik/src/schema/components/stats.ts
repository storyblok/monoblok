import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { headlineField } from '../fields';

export const statItemBlock = defineBlock({
  name: 'stat_item',
  is_nestable: true,
  schema: {
    label: defineProp(
      defineField({ type: 'text', max_length: 60 }),
      { pos: 0, required: true },
    ),
    value: defineProp(
      defineField({
        type: 'number',
        min_value: 0,
        max_value: 999999,
        decimals: 1,
        steps: 0.1,
      }),
      { pos: 1, required: true },
    ),
    prefix: defineProp(
      defineField({ type: 'text', max_length: 5 }),
      { pos: 2 },
    ),
    suffix: defineProp(
      defineField({ type: 'text', max_length: 10 }),
      { pos: 3 },
    ),
  },
});

export const statsBlock = defineBlock({
  name: 'stats',
  is_nestable: true,
  schema: {
    headline: defineProp(headlineField, { pos: 0 }),
    description: defineProp(
      defineField({
        type: 'textarea',
        max_length: 300,
        display_name: 'Section Description',
      }),
      { pos: 1 },
    ),
    items: defineProp(
      defineField({
        type: 'bloks',
        component_whitelist: [statItemBlock.name],
        minimum: 1,
        maximum: 6,
      }),
      { pos: 2 },
    ),
  },
});
