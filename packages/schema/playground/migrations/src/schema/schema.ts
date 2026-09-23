import { defineSchema } from "@storyblok/schema";
import type {
  BlockContent,
  Schema as InferSchema,
  Story as InferStory,
  MapiStory as InferStoryMapi,
} from "@storyblok/schema";
import { storyblokColorField } from "@storyblok/schema/field-plugins";

import { authorBlock } from "./blocks/author";
import { cardBlock } from "./blocks/card";
import { faqBlock, faqItemBlock } from "./blocks/faq";
import { galleryBlock } from "./blocks/gallery";
import { mediaBlock } from "./blocks/media";
import { pageBlock } from "./blocks/page";
import { pricingTableBlock } from "./blocks/pricing-table";
import { quoteBlock } from "./blocks/quote";
import { sectionBlock } from "./blocks/section";
import { teaserBlock } from "./blocks/teaser";
import {
  currenciesDatasource,
  faqCategoriesDatasource,
  sectionThemesDatasource,
} from "./datasources";

export const schema = defineSchema({
  blocks: {
    pageBlock,
    sectionBlock,
    cardBlock,
    authorBlock,
    teaserBlock,
    galleryBlock,
    mediaBlock,
    quoteBlock,
    faqBlock,
    faqItemBlock,
    pricingTableBlock,
  },
  datasources: {
    sectionThemesDatasource,
    faqCategoriesDatasource,
    currenciesDatasource,
  },
  fieldPlugins: {
    storyblokColorField,
  },
});

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema["blocks"];
export type FieldPlugins = Schema["fieldPlugins"];
export type Story = InferStory<Blocks, FieldPlugins>;
export type StoryMapi = InferStoryMapi<Blocks, FieldPlugins>;

// Type a component's props by block name: `Block<"card">`.
// Wraps `BlockContent`, selecting the block definition whose `name` matches and
// baking in the schema's blocks + registered field plugins.
export type Block<TName extends Blocks["name"]> = BlockContent<
  Extract<Blocks, { name: TName }>,
  Blocks,
  FieldPlugins
>;

// Loose union of every block's content, used by the dynamic component dispatcher.
export type AnyBlock = BlockContent<Blocks, Blocks, FieldPlugins>;
