import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { heroBlock } from './hero';
import { introBlock } from './intro';
import { mediaBlock } from './media';
import { teaserListBlock } from './teaser-list';

export const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: {
    seo_title: defineProp(defineField({ type: 'text', max_length: 70 }), { pos: 0 }),
    seo_description: defineProp(defineField({ type: 'textarea', max_length: 160 }), { pos: 1 }),
    blocks: defineProp(
      defineField({
        type: 'bloks',
        component_whitelist: [
          heroBlock.name,
          introBlock.name,
          mediaBlock.name,
          teaserListBlock.name,
        ],
      }),
      { pos: 2 },
    ),
  },
});
