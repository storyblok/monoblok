import { defineBlock, defineField, defineProp } from '@storyblok/schema';

export const teaserBlock = defineBlock({
  name: 'teaser',
  is_nestable: true,
  schema: {
    title: defineProp(defineField({ type: 'text', max_length: 120 }), { pos: 0, required: true }),
    description: defineProp(defineField({ type: 'textarea', max_length: 300 }), { pos: 1 }),
    image: defineProp(defineField({ type: 'asset', filetypes: ['images'] }), { pos: 2 }),
    link: defineProp(defineField({ type: 'multilink' }), { pos: 3 }),
  },
});
