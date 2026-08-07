import { defineBlock, defineField } from '@storyblok/schema';

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  fields: [
    defineField('headline', { type: 'text', max_length: 120, required: true }),
    defineField('image', { type: 'asset', filetypes: ['images'] }),
  ],
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  fields: [
    defineField('body', { type: 'bloks', allow: [heroBlock.name] }),
  ],
});

export const schema = {
  blocks: { pageBlock, heroBlock },
};
