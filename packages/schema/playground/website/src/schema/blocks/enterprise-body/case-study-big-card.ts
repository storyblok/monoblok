import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const caseStudyBigCardBlock = defineBlock({
  name: "case_study_big_card",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/case_study_big_card.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("title", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("description", {
      required: true,
      translatable: true,
      type: "textarea",
    }),
    defineField("logo", {
      required: true,
      type: "asset",
    }),
    defineField("metrics", {
      allow: ["metric"],
      maximum: 2,
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("cta", {
      allow: ["enterprise_cta"],
      maximum: 1,
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("image", {
      required: true,
      type: "asset",
    }),
    defineField("tab-7b371c98-b719-4fbc-af87-d497135e6071", {
      display_name: "Style",
      keys: ["show_corner_decoration"],
      type: "tab",
    }),
    defineField("tab-10d2ed18-afbf-432b-9d3a-64dc8f35931e", {
      display_name: "",
      type: "tab",
    }),
    defineField("show_corner_decoration", {
      type: "boolean",
    }),
  ],
});
