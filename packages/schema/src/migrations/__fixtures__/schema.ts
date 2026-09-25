/**
 * Fixture schemas for the migration engine's tests.
 *
 * `spikeSchema` is the "before" state the probe migrations run against.
 *
 * Shaped for the migration cases under test: a block (`spike_meta`) that nests
 * several levels deep under more than one parent, fields whose types want
 * coercing, and a root block matching the design doc's `article.author`.
 */
import { defineBlock, defineField, defineSchema } from "../../index";
import { storyblokColorField } from "../../field-plugins/index";
import type { Schema as InferSchema } from "../../index";

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

/**
 * A second schema, for the field-typing assertions the probe schema cannot
 * reach: an asset, a multilink, a `custom` field backed by a registered plugin,
 * an unrestricted `bloks` field, a layout-only `section`, and a block with no
 * fields at all. Kept apart from `spikeSchema` so the migration probes keep a
 * small, stable set of block and field names.
 */
export const probeHeroBlock = defineBlock({
  name: "probe_hero",
  is_nestable: true,
  fields: [
    defineField("headline", { type: "text", max_length: 120 }),
    defineField("image", { type: "asset", filetypes: ["images"] }),
    defineField("cta_link", { type: "multilink" }),
    defineField("accent_color", { type: "custom", field_type: "storyblok-colorpicker" }),
  ],
});

export const probeKitchenSinkBlock = defineBlock({
  name: "probe_kitchen_sink",
  is_nestable: true,
  fields: [
    defineField("text_field", { type: "text", max_length: 100 }),
    /** No `allow`, so the child type widens to every nestable block in the schema. */
    defineField("bloks_field", { type: "bloks" }),
    defineField("settings_section", {
      type: "section",
      keys: ["text_field"],
      fieldset: { title: "Text Fields", collapsible: true, collapsed: true },
    }),
  ],
});

/** No fields, so its content type is the envelope and nothing else. */
export const probeEmptyBlock = defineBlock({
  name: "probe_empty",
  is_nestable: true,
  fields: [],
});

/** Root-only, so an unrestricted `bloks` field must not offer it. */
export const probeRootBlock = defineBlock({
  name: "probe_root",
  is_root: true,
  is_nestable: false,
  fields: [defineField("title", { type: "text", max_length: 70 })],
});

export const probeFieldTypesSchema = defineSchema({
  blocks: { probeRootBlock, probeHeroBlock, probeKitchenSinkBlock, probeEmptyBlock },
  fieldPlugins: { storyblokColorField },
});

export type ProbeFieldTypesSchema = InferSchema<typeof probeFieldTypesSchema>;
