import { defineBlock, defineField } from '@storyblok/schema';

export const articleBlock = defineBlock({
  name: 'article',
  is_root: true,
  is_nestable: false,
  fields: [
    defineField('title', { type: 'text', max_length: 120, required: true }),
    defineField('excerpt', { type: 'textarea', max_length: 300 }),
    defineField('cover_image', { type: 'asset', filetypes: ['images'] }),
    defineField('author', { type: 'text', max_length: 80 }),
    defineField('published_at', { type: 'datetime' }),
    defineField('tags', { type: 'options', source: 'internal', datasource: 'blog-tags' }),
  ],
});
