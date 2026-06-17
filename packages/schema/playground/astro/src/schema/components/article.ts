import { defineBlock, defineField } from '@storyblok/schema';

import { richtextField } from '../fields';

export const articleBlock = defineBlock({
  name: 'article',
  is_nestable: true,
  fields: [
    defineField('content_tab', {
      type: 'tab',
      keys: ['title', 'author', 'publish_date', 'body'],
    }),
    defineField('title', {
      type: 'text',
      max_length: 200,
      translatable: true,
      display_name: 'Article Title',
      description: 'The main headline of the article',
      tooltip: true,
      required: true,
    }),
    defineField('author', {
      type: 'text',
      max_length: 100,
      default_value: 'Editorial Team',
    }),
    defineField('publish_date', { type: 'datetime', disable_time: false }),
    richtextField,
    defineField('settings_tab', {
      type: 'tab',
      keys: ['featured', 'slug_override'],
    }),
    defineField('featured', {
      type: 'boolean',
      inline_label: true,
      default_value: 'false',
    }),
    defineField('slug_override', {
      type: 'text',
      max_length: 80,
      regex: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    }),
  ],
});
