import { defineBlock, defineField } from "@storyblok/schema";

export const mediaBlock = defineBlock({
  name: "media",
  is_nestable: true,
  fields: [
    defineField("image", { type: "asset", filetypes: ["images"], required: true }),
    defineField("caption", { type: "text", max_length: 200, translatable: true }),
    defineField("credit", { type: "text", max_length: 120 }),
  ],
});
