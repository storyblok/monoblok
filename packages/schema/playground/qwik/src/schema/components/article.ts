import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { richtextField } from '../fields';
import { contentFolder } from './folders/content';

export const articleBlock = defineBlock({
  name: 'article',
  is_nestable: true,
  component_group_uuid: contentFolder.uuid,
  schema: {
    content_tab: defineProp(
      defineField({
        type: 'tab',
        keys: ['title', 'author', 'publish_date', 'body'],
      }),
      { pos: 0 },
    ),
    title: defineProp(
      defineField({
        type: 'text',
        max_length: 200,
        translatable: true,
        display_name: 'Article Title',
        description: 'The main headline of the article',
        tooltip: true,
      }),
      { pos: 1, required: true },
    ),
    author: defineProp(
      defineField({
        type: 'text',
        max_length: 100,
        default_value: 'Editorial Team',
      }),
      { pos: 2 },
    ),
    publish_date: defineProp(
      defineField({ type: 'datetime', disable_time: false }),
      { pos: 3 },
    ),
    body: defineProp(richtextField, { pos: 4 }),
    settings_tab: defineProp(
      defineField({
        type: 'tab',
        keys: ['featured', 'slug_override'],
      }),
      { pos: 5 },
    ),
    featured: defineProp(
      defineField({
        type: 'boolean',
        inline_label: true,
        default_value: 'false',
      }),
      { pos: 6 },
    ),
    slug_override: defineProp(
      defineField({
        type: 'text',
        max_length: 80,
        regex: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      }),
      { pos: 7 },
    ),
  },
});
