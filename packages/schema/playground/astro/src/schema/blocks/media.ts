import { defineBlock, defineField } from '@storyblok/schema';
import { markdownField } from '../fields';

export const mediaBlock = defineBlock({
  name: 'media',
  is_nestable: true,
  fields: [
    defineField('image', { type: 'asset', filetypes: ['images'], required: true }),
    defineField('caption', { type: 'text', max_length: 200 }),
    defineField('text', markdownField),
  ],
});
