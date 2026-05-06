import { defineBlock, defineField } from '@storyblok/schema';
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
  schema: [
    defineField('seo_title', { type: 'text', max_length: 70 }),
    defineField('seo_description', { type: 'textarea', max_length: 160 }),
    defineField('blocks', {
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
  ],
});
