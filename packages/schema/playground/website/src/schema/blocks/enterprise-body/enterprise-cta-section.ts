import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseCtaSectionBlock = defineBlock({
  name: "enterprise_cta_section",
  display_name: "CTA Section",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_cta_section.png",
  preview_field: "headline",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("background_image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("headline_size", {
      default_value: " ",
      options: [
        {
          name: "Normal ",
          value: " ",
        },
        {
          name: "Large",
          value: "large",
        },
      ],
      type: "option",
    }),
    defineField("inner_spacing", {
      default_value: " ",
      options: [
        {
          name: "Small",
          value: " ",
        },
        {
          name: "Medium",
          value: "medium",
        },
      ],
      type: "option",
    }),
    defineField("anchor", {
      translatable: true,
      type: "text",
    }),
    defineField("tab-d309809c-b050-4bb5-bb88-2ac0812b0fe3", {
      display_name: "Style",
      keys: ["background_image", "headline_size", "inner_spacing"],
      type: "tab",
    }),
    defineField("tab-49eace05-da80-440e-bb0b-b92e76d8e34f", {
      display_name: "Options",
      keys: ["anchor", "test"],
      type: "tab",
    }),
    defineField("headline", {
      translatable: true,
      type: "text",
    }),
    defineField("text", {
      translatable: true,
      type: "textarea",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      maximum: 2,
      type: "bloks",
    }),
    defineField("foot_note", {
      translatable: true,
      type: "text",
    }),
  ],
});
