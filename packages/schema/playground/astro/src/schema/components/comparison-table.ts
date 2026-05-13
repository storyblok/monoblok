import { defineBlock, defineField } from '@storyblok/schema';

import { headlineField } from '../fields';

export const comparisonTableBlock = defineBlock({
  name: 'comparison_table',
  is_nestable: true,
  schema: [
    headlineField,
    defineField('description', { type: 'textarea', max_length: 300 }),
    defineField('table', { type: 'table' }),
    defineField('footnote', {
      type: 'text',
      max_length: 300,
      translatable: true,
      display_name: 'Footnote',
      description: 'Small print below the table',
    }),
  ],
});
