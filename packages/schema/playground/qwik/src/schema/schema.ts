import type { Schema as InferSchema, Story as InferStory } from '@storyblok/schema';
import type { Story as InferStoryMapi } from '@storyblok/schema/mapi';

import { articleBlock } from './components/article';
import { bannerBlock } from './components/banner';
import { comparisonTableBlock } from './components/comparison-table';
import { faqBlock, faqItemBlock } from './components/faq';
import { galleryBlock } from './components/gallery';
import { heroBlock } from './components/hero';
import { introBlock } from './components/intro';
import { mediaBlock } from './components/media';
import { statItemBlock, statsBlock } from './components/stats';
import { teaserListBlock } from './components/teaser-list';
import { teaserBlock } from './components/teaser';
import { pageBlock } from './components/page';
import { contentFolder } from './components/folders/content';
import { layoutFolder } from './components/folders/layout';
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
  blockFolders: {
    layoutFolder,
    contentFolder,
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
