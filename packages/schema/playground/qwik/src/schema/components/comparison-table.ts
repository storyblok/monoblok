import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { headlineField } from '../fields';

export const comparisonTableBlock = defineBlock({
  name: 'comparison_table',
  is_nestable: true,
  schema: {
    headline: defineProp(headlineField, { pos: 0 }),
    description: defineProp(
      defineField({ type: 'textarea', max_length: 300 }),
      { pos: 1 },
    ),
    table: defineProp(
      defineField({ type: 'table' }),
      { pos: 2 },
    ),
    footnote: defineProp(
      defineField({
        type: 'text',
        max_length: 300,
        translatable: true,
        display_name: 'Footnote',
        description: 'Small print below the table',
      }),
      { pos: 3 },
    ),
  },
});
