import { defineBlock, defineField } from '@storyblok/schema';

export const teaserBlock = defineBlock({
  name: 'teaser',
  is_nestable: true,
  schema: [
    defineField('title', { type: 'text', max_length: 120, required: true }),
    defineField('description', { type: 'textarea', max_length: 300 }),
    defineField('image', { type: 'asset', filetypes: ['images'] }),
    defineField('link', { type: 'multilink' }),
  ],
});
