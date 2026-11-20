import { defineBlock, defineField } from "@storyblok/schema";

export const roiBenefitsInfoBlock = defineBlock({
  name: "roi_benefits_info",
  is_root: false,
  is_nestable: true,
  fields: [
    defineField("image", {
      type: "asset",
    }),
    defineField("headline", {
      type: "text",
    }),
    defineField("description", {
      type: "textarea",
    }),
  ],
});
