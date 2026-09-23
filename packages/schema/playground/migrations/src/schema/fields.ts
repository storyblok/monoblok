import { defineField } from "@storyblok/schema";

export const headlineField = defineField("headline", {
  type: "text",
  max_length: 120,
  translatable: true,
});

export const eyebrowField = defineField("eyebrow", { type: "text", max_length: 80 });

/**
 * Richtext with the blok toolbar entry enabled: content authored here can hold
 * nested blocks, so a migration that only walks `content.body` arrays misses them.
 */
export const richtextField = defineField("body", {
  type: "richtext",
  customize_toolbar: true,
  toolbar: ["bold", "italic", "link", "h2", "h3", "list", "olist", "quote", "code", "blok"],
});
