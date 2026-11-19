import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const pricingTableBlock = defineBlock({
  name: "pricing_table",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/pricing_table.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("plans", {
      allow: ["pricing_plan"],
      minimum: 3,
      type: "bloks",
    }),
    defineField("table_id", {
      description:
        "It is used as an anchor/identifier of the table, so we can jump link to the correct table. Each table on the page should have it's unique ID.",
      display_name: "Unique TableID",
      type: "text",
    }),
    defineField("general_content", {
      filter_content_type: ["pricing_feature"],
      folder_slug: "pricing/pricing-features/general",
      source: "internal_stories",
      type: "options",
    }),
    defineField("content", {
      allow: ["pricing_table_section"],
      minimum: 1,
      type: "bloks",
    }),
    defineField("optional_cta", {
      allow: ["enterprise_cta"],
      type: "bloks",
    }),
    defineField("tab-beaeafca-ad1c-4d9d-b1b8-82bdfdcac84a", {
      display_name: "Settings",
      keys: ["table_id"],
      type: "tab",
    }),
  ],
});
