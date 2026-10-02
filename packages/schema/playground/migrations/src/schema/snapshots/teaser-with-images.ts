/**
 * The teaser after its single `image` becomes a multi-asset `images`. The
 * `After` of `0011-single-asset-to-list`; the source field comes from the
 * current schema.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const teaserBlock = defineBlock({
  name: "teaser",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 120, translatable: true, required: true }),
    defineField("description", { type: "textarea", max_length: 300, translatable: true }),
    defineField("images", { type: "multiasset", filetypes: ["images"] }),
    defineField("link", { type: "multilink" }),
  ],
});

const snapshot = defineSchema({ blocks: { teaserBlock } });

export type TeaserWithImages = Schema<typeof snapshot>;
