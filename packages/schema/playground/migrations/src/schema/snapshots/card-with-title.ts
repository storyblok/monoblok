/**
 * The card as it stood before it gained a `headline`: a `title`, a `subtitle`
 * the current schema no longer declares, and a single `image` rather than a
 * list. Read by `0001-rename-card-title` and `0006-remove-card-subtitle`.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const cardBlock = defineBlock({
  name: "card",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 120, translatable: true, required: true }),
    defineField("subtitle", { type: "text", max_length: 200 }),
    defineField("body", { type: "richtext" }),
    defineField("image", { type: "asset", filetypes: ["images"] }),
    defineField("link", { type: "multilink" }),
    defineField("price", { type: "number" }),
  ],
});

const snapshot = defineSchema({ blocks: { cardBlock } });

export type CardWithTitle = Schema<typeof snapshot>;
