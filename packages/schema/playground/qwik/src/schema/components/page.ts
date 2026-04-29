import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { articleBlock } from './article';
import { bannerBlock } from './banner';
import { comparisonTableBlock } from './comparison-table';
import { faqBlock } from './faq';
import { galleryBlock } from './gallery';
import { heroBlock } from './hero';
import { introBlock } from './intro';
import { mediaBlock } from './media';
import { statsBlock } from './stats';
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
          articleBlock.name,
          bannerBlock.name,
          galleryBlock.name,
          faqBlock.name,
          statsBlock.name,
          comparisonTableBlock.name,
        ],
      }),
      { pos: 2 },
    ),
  },
});
