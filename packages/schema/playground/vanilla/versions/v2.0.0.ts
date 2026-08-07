import { defineBlock, defineField } from '@storyblok/schema';

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  fields: [
    // Breaking: hero renames 'headline' → 'title' and replaces 'image' with 'gallery' (multiasset)
    defineField('title', { type: 'text', max_length: 120, required: true }),
    defineField('subtitle', { type: 'text', max_length: 200, translatable: true }),
    defineField('gallery', { type: 'multiasset', filetypes: ['images'] }),
    defineField('cta_label', { type: 'text', max_length: 40 }),
    defineField('cta_link', { type: 'multilink' }),
  ],
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  fields: [
    defineField('title', { type: 'text', max_length: 70 }),
    defineField('seo_description', { type: 'textarea', max_length: 160 }),
    defineField('body', { type: 'bloks', allow: [heroBlock.name] }),
  ],
});

export const schema = {
  blocks: { pageBlock, heroBlock },
};
