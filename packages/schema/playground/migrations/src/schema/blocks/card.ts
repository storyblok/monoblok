import { defineBlock, defineField } from "@storyblok/schema";

export const cardBlock = defineBlock({
  name: "card",
  is_nestable: true,
  fields: [
    defineField("headline", { type: "text", max_length: 120, translatable: true, required: true }),
    defineField("body", { type: "richtext" }),
    defineField("images", { type: "multiasset", filetypes: ["images"] }),
    defineField("link", { type: "multilink" }),
    defineField("price", { type: "number" }),
    defineField("slug", { type: "text" }),
    defineField("category", { type: "option", source: "internal_stories" }),
  ],
});
