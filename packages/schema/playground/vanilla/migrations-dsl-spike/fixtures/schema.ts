/**
 * SPIKE fixture schema — the "before" state the probe migrations run against.
 *
 * Shaped for the migration cases under test: a block (`spike_meta`) that nests
 * several levels deep under more than one parent, fields whose types want
 * coercing, and a root block matching the design doc's `article.author`.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema as InferSchema } from "@storyblok/schema";

export const spikeMetaBlock = defineBlock({
  name: "spike_meta",
  is_nestable: true,
  fields: [
    defineField("author", { type: "text", max_length: 80 }),
    defineField("og_title", { type: "text", max_length: 120 }),
  ],
});

export const spikeCardBlock = defineBlock({
  name: "spike_card",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 80, required: true }),
    defineField("description", { type: "textarea", max_length: 300 }),
    defineField("legacy_price", { type: "text", max_length: 20 }),
    defineField("featured", { type: "text", max_length: 10 }),
    defineField("old_slug", { type: "text", max_length: 80 }),
    defineField("slug", { type: "text", max_length: 80 }),
    defineField("meta", { type: "bloks", allow: [spikeMetaBlock.name] }),
  ],
});

export const spikeSectionBlock = defineBlock({
  name: "spike_section",
  is_nestable: true,
  fields: [
    defineField("heading", { type: "text", max_length: 120 }),
    defineField("items", { type: "bloks", allow: [spikeCardBlock.name] }),
    defineField("meta", { type: "bloks", allow: [spikeMetaBlock.name] }),
  ],
});

export const spikePageBlock = defineBlock({
  name: "spike_page",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", { type: "text", max_length: 70 }),
    defineField("body", { type: "bloks", allow: [spikeSectionBlock.name, spikeMetaBlock.name] }),
  ],
});

export const spikeArticleBlock = defineBlock({
  name: "spike_article",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", { type: "text", max_length: 120, required: true }),
    defineField("author", { type: "text", max_length: 80 }),
    defineField("excerpt", { type: "textarea", max_length: 300 }),
    defineField("body", { type: "richtext" }),
  ],
});

/** Defined in the schema but used by no story — the zero-match case. */
export const spikeBannerBlock = defineBlock({
  name: "spike_banner",
  is_nestable: true,
  fields: [defineField("label", { type: "text", max_length: 40 })],
});

export const spikeSchema = defineSchema({
  blocks: {
    spikePageBlock,
    spikeArticleBlock,
    spikeSectionBlock,
    spikeCardBlock,
    spikeMetaBlock,
    spikeBannerBlock,
  },
});

export type SpikeSchema = InferSchema<typeof spikeSchema>;
