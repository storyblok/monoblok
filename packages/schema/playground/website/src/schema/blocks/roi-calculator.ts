import { defineBlock, defineField } from "@storyblok/schema";

export const roiCalculatorBlock = defineBlock({
  name: "roi_calculator",
  is_root: false,
  is_nestable: true,
  image: "https://example.com/component-screenshots/roi_calculator.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("results_headline", {
      type: "text",
    }),
    defineField("results_description", {
      type: "textarea",
    }),
    defineField("benefits_info", {
      allow: ["roi_benefits_info"],
      type: "bloks",
    }),
  ],
});
