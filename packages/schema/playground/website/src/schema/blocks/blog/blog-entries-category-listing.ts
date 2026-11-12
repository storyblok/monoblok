import { defineBlock, defineField } from "@storyblok/schema";

import { blogFolder } from "../../folders";

export const blogEntriesCategoryListingBlock = defineBlock({
  name: "blog_entries_category_listing",
  is_root: false,
  is_nestable: true,
  folder: blogFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/blog_entries_category_listing.png",
  fields: [
    defineField("category", {
      datasource: "blog-categories",
      exclude_empty_option: true,
      required: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
  ],
});
