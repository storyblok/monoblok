import { defineBlock, defineField } from "@storyblok/schema";

import { authorBlock } from "./author";

export const quoteBlock = defineBlock({
  name: "quote",
  is_nestable: true,
  fields: [
    defineField("text", { type: "textarea", max_length: 400, translatable: true, required: true }),
    defineField("attribution", { type: "text", max_length: 120 }),
    defineField("source_link", { type: "multilink" }),
    defineField("authors", { type: "bloks", allow: [authorBlock.name], maximum: 2 }),
  ],
});
