import { defineBlock, defineField } from '@storyblok/schema';

import { headlineField } from '../fields';

export const statItemBlock = defineBlock({
  name: 'stat_item',
  is_nestable: true,
  schema: [
    defineField('label', { type: 'text', max_length: 60, required: true }),
    defineField('value', {
      type: 'number',
      min_value: 0,
      max_value: 999999,
      decimals: 1,
      steps: 0.1,
      required: true,
    }),
    defineField('prefix', { type: 'text', max_length: 5 }),
    defineField('suffix', { type: 'text', max_length: 10 }),
  ],
});

export const statsBlock = defineBlock({
  name: 'stats',
  is_nestable: true,
  schema: [
    headlineField,
    defineField('description', {
      type: 'textarea',
      max_length: 300,
      display_name: 'Section Description',
    }),
    defineField('items', {
      type: 'bloks',
      component_whitelist: [statItemBlock.name],
      minimum: 1,
      maximum: 6,
    }),
  ],
});
