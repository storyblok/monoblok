import { defineBlock, defineField } from "@storyblok/schema";

export const pricingTableSectionBlock = defineBlock({
  name: "pricing_table_section",
  is_root: false,
  is_nestable: true,
  fields: [
    defineField("name", {
      display_name: "",
      required: true,
      type: "text",
    }),
    defineField("features", {
      filter_content_type: ["pricing_feature"],
      source: "internal_stories",
      type: "options",
    }),
    defineField("subsections", {
      allow: ["pricing_table_section"],
      description: "please don't add subsections to subsections",
      type: "bloks",
    }),
  ],
});
