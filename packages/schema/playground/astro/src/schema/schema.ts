import { defineSchema } from '@storyblok/schema';
import type {
  BlockContent,
  Schema as InferSchema,
  Story as InferStory,
  MapiStory as InferStoryMapi,
} from '@storyblok/schema';
import { storyblokColorField } from '@storyblok/schema/field-plugins';

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

export const schema = defineSchema({
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
  fieldPlugins: {
    storyblokColorField,
  },
});

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema['blocks'];
export type FieldPlugins = Schema['fieldPlugins'];
export type Story = InferStory<Blocks, FieldPlugins>;
export type StoryMapi = InferStoryMapi<Blocks, FieldPlugins>;

// Type a component's props by block name: `Block<"hero">`.
// Wraps `BlockContent`, selecting the block definition whose `name` matches and
// baking in the schema's blocks + registered field plugins.
export type Block<TName extends Blocks['name']> = BlockContent<
  Extract<Blocks, { name: TName }>,
  Blocks,
  FieldPlugins
>;

// Loose union of every block's content, used by the dynamic component dispatcher.
export type AnyBlock = BlockContent<Blocks, Blocks, FieldPlugins>;
