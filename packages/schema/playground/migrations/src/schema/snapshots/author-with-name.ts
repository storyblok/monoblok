/**
 * The author with one `name` field instead of two halves. It is the `Before` of
 * `0003-split-author-name` and the `After` of `0004-merge-author-name`, which
 * is the same shape seen from either side.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const authorBlock = defineBlock({
  name: "author",
  is_nestable: true,
  fields: [
    defineField("name", { type: "text", max_length: 160 }),
    defineField("bio", { type: "textarea" }),
    defineField("avatar", { type: "asset", filetypes: ["images"] }),
  ],
});

const snapshot = defineSchema({ blocks: { authorBlock } });

export type AuthorWithName = Schema<typeof snapshot>;
