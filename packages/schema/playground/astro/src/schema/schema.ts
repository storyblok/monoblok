import type { Schema as InferSchema, Story as InferStory, MapiStory as InferStoryMapi } from '@storyblok/schema';

import { articleBlock } from './blocks/article';
import { bannerBlock } from './blocks/banner';
import { comparisonTableBlock } from './blocks/comparison-table';
import { faqBlock, faqItemBlock } from './blocks/faq';
import { galleryBlock } from './blocks/gallery';
import { heroBlock } from './blocks/hero';
import { introBlock } from './blocks/intro';
import { mediaBlock } from './blocks/media';
import { statItemBlock, statsBlock } from './blocks/stats';
import { teaserListBlock } from './blocks/teaser-list';
import { teaserBlock } from './blocks/teaser';
import { pageBlock } from './blocks/page';
import { bannerThemesDatasource, faqCategoriesDatasource } from './datasources';

export const schema = {
  blocks: {
    pageBlock,
    heroBlock,
    introBlock,
    mediaBlock,
    teaserListBlock,
    teaserBlock,
    articleBlock,
    bannerBlock,
    galleryBlock,
    faqBlock,
    faqItemBlock,
    statsBlock,
    statItemBlock,
    comparisonTableBlock,
  },
  datasources: {
    bannerThemesDatasource,
    faqCategoriesDatasource,
  },
};

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema['blocks'];
export type Story = InferStory<Blocks>;
export type StoryMapi = InferStoryMapi<Blocks>;
