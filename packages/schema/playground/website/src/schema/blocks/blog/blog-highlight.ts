import { defineBlock, defineField } from "@storyblok/schema";

import { blogFolder } from "../../folders";

export const blogHighlightBlock = defineBlock({
  name: "blog_highlight",
  is_root: false,
  is_nestable: true,
  folder: blogFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/blog_highlight.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("entries", {
      allow_advanced_search: true,
      entry_appearance: "card",
      filter_content_type: ["blog_entry"],
      is_reference_type: true,
      max_options: 3,
      min_options: 3,
      required: true,
      source: "internal_stories",
      type: "options",
    }),
  ],
});
