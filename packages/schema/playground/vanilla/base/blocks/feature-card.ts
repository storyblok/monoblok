import { defineBlock, defineField, hideWhen } from "@storyblok/schema";

export const featureCardBlock = defineBlock({
  name: "feature_card",
  is_nestable: true,
  preview_field: "title",
  fields: [
    defineField("title", { type: "text", max_length: 80, required: true }),
    defineField("description", { type: "textarea", max_length: 300 }),
    defineField("image", { type: "asset", filetypes: ["images"] }),
    defineField("icon", { type: "option", source: "internal", datasource: "icons" }),
    defineField("link", { type: "multilink" }),
    defineField("is_highlighted", { type: "boolean", inline_label: true }),
    defineField("highlight_color", {
      type: "text",
      max_length: 7,
      description: "Hex color code",
      // Inverted on purpose: the editor only offers "hide when". An unchecked
      // boolean counts as empty, but an untouched one is absent, which reads as
      // no match, so this is visible on a fresh story.
      conditional_settings: [hideWhen({ field: "is_highlighted", is: "empty" })],
    }),
  ],
});
