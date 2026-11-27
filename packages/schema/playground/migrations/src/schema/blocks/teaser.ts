import { defineBlock, defineField } from "@storyblok/schema";

import { authorBlock } from "./author";

export const teaserBlock = defineBlock({
  name: "teaser",
  is_nestable: true,
  fields: [
    defineField("title", { type: "text", max_length: 120, translatable: true, required: true }),
    defineField("description", { type: "textarea", max_length: 300, translatable: true }),
    defineField("image", { type: "asset", filetypes: ["images"] }),
    defineField("link", { type: "multilink" }),
    defineField("authors", { type: "bloks", allow: [authorBlock.name] }),
  ],
});
