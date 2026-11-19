import { defineBlock, defineField } from "@storyblok/schema";

import { blogFolder } from "../../folders";

export const blogCategoryListingPageBlock = defineBlock({
  name: "blog_category_listing_page",
  display_name: "Blog Category Listing Page",
  is_root: true,
  is_nestable: false,
  folder: blogFolder,
  fields: [
    defineField("blog_category_listing", {
      allow: ["blog_entries_category_listing"],
      maximum: 1,
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Enterprise Body",
        },
      ],
      required: false,
      type: "bloks",
    }),
    defineField("og_description", {
      display_name: "Description",
      translatable: true,
      type: "textarea",
    }),
    defineField("og_image", {
      display_name: "OG Image",
      filetypes: ["images"],
      required: false,
      translatable: true,
      type: "asset",
    }),
    defineField("noindex", {
      description: "Hide this entry from search engines and from the internal search",
      type: "boolean",
    }),
    defineField("tab-1cb7dda7-ec2f-4dcc-870d-0b30ceb2a008", {
      display_name: "Content",
      keys: ["blog_category_listing", "body"],
      type: "tab",
    }),
  ],
});
