/**
 * The page before `0022-og-image-url-to-asset`: the social image is a text
 * field holding a URL, which is what an early space looks like when the field
 * predates the asset field type.
 *
 * Scoped to the one field the migration reads. The `After` end is the current
 * schema, where the page carries `og_image_asset` instead.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const pageBlock = defineBlock({
  name: "page",
  is_root: true,
  is_nestable: false,
  fields: [defineField("og_image", { type: "text", max_length: 255, translatable: true })],
});

const snapshot = defineSchema({ blocks: { pageBlock } });

export type PageWithOgImageUrl = Schema<typeof snapshot>;
