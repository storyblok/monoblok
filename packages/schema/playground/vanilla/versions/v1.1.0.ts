import { defineBlock, defineField } from '@storyblok/schema';

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  fields: [
    // 1.1.0 - Adds subtitle and cta_link
    defineField('headline', { type: 'text', max_length: 120, required: true }),
    defineField('subtitle', { type: 'text', max_length: 200, translatable: true }),
    defineField('image', { type: 'asset', filetypes: ['images'] }),
    defineField('cta_link', { type: 'multilink' }),
  ],
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  fields: [
    // 1.1.0 - Adds title
    defineField('title', { type: 'text', max_length: 70 }),
    defineField('body', { type: 'bloks', allow: [heroBlock.name] }),
  ],
});

export const schema = {
  blocks: { pageBlock, heroBlock },
};
