import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { markdownField } from '../fields';

export const mediaBlock = defineBlock({
  name: 'media',
  is_nestable: true,
  schema: {
    image: defineProp(defineField({ type: 'asset', filetypes: ['images'] }), { pos: 0, required: true }),
    caption: defineProp(defineField({ type: 'text', max_length: 200 }), { pos: 1 }),
    text: defineProp(markdownField, { pos: 2 }),
  },
});
