import { defineBlock, defineField } from '@storyblok/schema';

import { headlineField, richtextField } from '../fields';

export const faqItemBlock = defineBlock({
  name: 'faq_item',
  is_nestable: true,
  fields: [
    defineField('question', {
      type: 'text',
      max_length: 200,
      translatable: true,
      required: true,
    }),
    defineField('answer', { ...richtextField }),
  ],
});

export const faqBlock = defineBlock({
  name: 'faq',
  is_nestable: true,
  fields: [
    defineField('settings_section', {
      type: 'section',
      keys: ['headline', 'categories'],
      fieldset: {
        title: 'Settings',
        description: 'Configure the FAQ section',
        collapsible: true,
        collapsed: false,
      },
    }),
    headlineField,
    defineField('categories', {
      type: 'options',
      source: 'internal',
      datasource: 'faq_categories',
    }),
    defineField('items_section', {
      type: 'section',
      keys: ['items'],
      fieldset: {
        title: 'FAQ Items',
        description: 'Add question-answer pairs',
        collapsible: true,
        collapsed: false,
      },
    }),
    defineField('items', {
      type: 'bloks',
      allow: [faqItemBlock.name],
      minimum: 1,
    }),
  ],
});
