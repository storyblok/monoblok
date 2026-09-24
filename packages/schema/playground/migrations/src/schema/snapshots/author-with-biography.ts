/**
 * The author after `bio` becomes `biography`. The `After` of
 * `0002-rename-nested-author-bio`, whose source name comes from the current
 * schema.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const authorBlock = defineBlock({
  name: "author",
  is_nestable: true,
  fields: [
    defineField("first_name", { type: "text", max_length: 80 }),
    defineField("last_name", { type: "text", max_length: 80 }),
    defineField("biography", { type: "textarea" }),
    defineField("avatar", { type: "asset", filetypes: ["images"] }),
  ],
});

const snapshot = defineSchema({ blocks: { authorBlock } });

export type AuthorWithBiography = Schema<typeof snapshot>;
