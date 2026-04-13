import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { headlineField, richtextField } from '../fields';

export const faqItemBlock = defineBlock({
  name: 'faq_item',
  is_nestable: true,
  schema: {
    question: defineProp(
      defineField({
        type: 'text',
        max_length: 200,
        translatable: true,
      }),
      { pos: 0, required: true },
    ),
    answer: defineProp(richtextField, { pos: 1 }),
  },
});

export const faqBlock = defineBlock({
  name: 'faq',
  is_nestable: true,
  schema: {
    settings_section: defineProp(
      defineField({
        type: 'section',
        keys: ['headline', 'categories'],
        fieldset: {
          title: 'Settings',
          description: 'Configure the FAQ section',
          collapsible: true,
          collapsed: false,
        },
      }),
      { pos: 0 },
    ),
    headline: defineProp(headlineField, { pos: 1 }),
    categories: defineProp(
      defineField({
        type: 'options',
        source: 'internal',
        datasource_slug: 'faq_categories',
      }),
      { pos: 2 },
    ),
    items_section: defineProp(
      defineField({
        type: 'section',
        keys: ['items'],
        fieldset: {
          title: 'FAQ Items',
          description: 'Add question-answer pairs',
          collapsible: true,
          collapsed: false,
        },
      }),
      { pos: 3 },
    ),
    items: defineProp(
      defineField({
        type: 'bloks',
        component_whitelist: [faqItemBlock.name],
        minimum: 1,
      }),
      { pos: 4 },
    ),
  },
});
