import { defineBlock, defineField } from "@storyblok/schema";

import { searchFolder } from "../../folders";

export const searchBlock = defineBlock({
  name: "search",
  display_name: "Search",
  is_root: true,
  is_nestable: false,
  folder: searchFolder,
  fields: [
    defineField("search_suggestions", {
      description: "Comma separated list of keywords",
      type: "textarea",
    }),
    defineField("featured_tutorials", {
      allow: ["featured_search_result"],
      maximum: 10,
      type: "bloks",
    }),
    defineField("featured_blog_entries", {
      allow: ["featured_search_result"],
      maximum: 4,
      type: "bloks",
    }),
    defineField("featured_docs", {
      allow: ["featured_search_result"],
      maximum: 10,
      type: "bloks",
    }),
    defineField("featured_pages", {
      allow: ["featured_search_result"],
      maximum: 10,
      type: "bloks",
    }),
    defineField("tab-5778798d-1f32-4319-9613-3b7157cb2ee0", {
      display_name: "Settings",
      keys: [
        "featured_pages",
        "featured_docs",
        "featured_blog_entries",
        "featured_tutorials",
        "search_suggestions",
      ],
      type: "tab",
    }),
    defineField("og_description", {
      display_name: "Description",
      translatable: true,
      type: "textarea",
    }),
    defineField("og_image", {
      display_name: "OG Image",
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
  ],
});
