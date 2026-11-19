import { defineBlock, defineField } from "@storyblok/schema";

import { blogFolder } from "../../folders";

export const blogEntriesListingBlock = defineBlock({
  name: "blog_entries_listing",
  is_root: false,
  is_nestable: true,
  folder: blogFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/blog_entries_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [],
});
