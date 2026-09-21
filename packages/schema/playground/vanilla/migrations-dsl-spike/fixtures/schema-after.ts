/**
 * SPIKE fixture — the post-migration schemas.
 *
 * One per migration under test, because a migration has exactly one `After`:
 * the schema module the developer just edited. In the real design this is not a
 * fixture at all — it is the project's live schema, and only `Before` is a
 * generated snapshot.
 *
 * Post-condition validation runs against these and never against `Before`: the
 * whole point of a migration is that the content stops matching `Before`.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema as InferSchema } from "@storyblok/schema";
import {
  spikeArticleBlock,
  spikeBannerBlock,
  spikeCardBlock,
  spikeMetaBlock,
  spikePageBlock,
  spikeSectionBlock,
} from "./schema";

/** 0001 — `spike_article.author` becomes `byline`. */
const articleWithByline = defineBlock({
  name: "spike_article",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", { type: "text", max_length: 120, required: true }),
    defineField("byline", { type: "text", max_length: 80 }),
    defineField("excerpt", { type: "textarea", max_length: 300 }),
    defineField("body", { type: "richtext" }),
  ],
});

export const afterRenameArticleAuthor = defineSchema({
  blocks: {
    spikePageBlock,
    articleWithByline,
    spikeSectionBlock,
    spikeCardBlock,
    spikeMetaBlock,
    spikeBannerBlock,
  },
});

/** 0002 — `spike_meta.author` becomes `written_by`, at every depth. */
const metaWithWrittenBy = defineBlock({
  name: "spike_meta",
  is_nestable: true,
  fields: [
    defineField("written_by", { type: "text", max_length: 80 }),
    defineField("og_title", { type: "text", max_length: 120 }),
  ],
});

export const afterRenameMetaAuthor = defineSchema({
  blocks: {
    spikePageBlock,
    spikeArticleBlock,
    spikeSectionBlock,
    spikeCardBlock,
    metaWithWrittenBy,
    spikeBannerBlock,
  },
});

/** 0003 — `spike_card.description` is gone. */
const cardWithoutDescription = defineBlock({
  name: "spike_card",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 80, required: true }),
    defineField("legacy_price", { type: "text", max_length: 20 }),
    defineField("featured", { type: "text", max_length: 10 }),
    defineField("old_slug", { type: "text", max_length: 80 }),
    defineField("slug", { type: "text", max_length: 80 }),
    defineField("meta", { type: "bloks", allow: [spikeMetaBlock.name] }),
  ],
});

export const afterRemoveCardDescription = defineSchema({
  blocks: {
    spikePageBlock,
    spikeArticleBlock,
    spikeSectionBlock,
    cardWithoutDescription,
    spikeMetaBlock,
    spikeBannerBlock,
  },
});

/** 0004 — the two coerced fields change type. */
const cardWithTypedFields = defineBlock({
  name: "spike_card",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 80, required: true }),
    defineField("description", { type: "textarea", max_length: 300 }),
    defineField("legacy_price", { type: "number" }),
    defineField("featured", { type: "boolean" }),
    defineField("old_slug", { type: "text", max_length: 80 }),
    defineField("slug", { type: "text", max_length: 80 }),
    defineField("meta", { type: "bloks", allow: [spikeMetaBlock.name] }),
  ],
});

export const afterCoerceCardTypes = defineSchema({
  blocks: {
    spikePageBlock,
    spikeArticleBlock,
    spikeSectionBlock,
    cardWithTypedFields,
    spikeMetaBlock,
    spikeBannerBlock,
  },
});

/** 0008 — `spike_article.excerpt` becomes `summary`; `spike_card.title` stays text. */
const articleWithSummary = defineBlock({
  name: "spike_article",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", { type: "text", max_length: 120, required: true }),
    defineField("author", { type: "text", max_length: 80 }),
    defineField("summary", { type: "textarea", max_length: 300 }),
    defineField("body", { type: "richtext" }),
  ],
});

export const afterTwoBlocks = defineSchema({
  blocks: {
    spikePageBlock,
    articleWithSummary,
    spikeSectionBlock,
    spikeCardBlock,
    spikeMetaBlock,
    spikeBannerBlock,
  },
});

export type AfterTwoBlocks = InferSchema<typeof afterTwoBlocks>;
export type AfterRenameArticleAuthor = InferSchema<typeof afterRenameArticleAuthor>;
export type AfterRenameMetaAuthor = InferSchema<typeof afterRenameMetaAuthor>;
export type AfterRemoveCardDescription = InferSchema<typeof afterRemoveCardDescription>;
export type AfterCoerceCardTypes = InferSchema<typeof afterCoerceCardTypes>;
