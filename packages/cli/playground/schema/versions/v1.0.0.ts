import { defineBlock, defineField } from '@storyblok/schema';

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  schema: [
    defineField('headline', { type: 'text', max_length: 120, required: true }),
    defineField('image', { type: 'asset', filetypes: ['images'] }),
  ],
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: [
    defineField('body', { type: 'bloks', component_whitelist: [heroBlock.name] }),
  ],
});

export const schema = {
  blocks: { pageBlock, heroBlock },
};
