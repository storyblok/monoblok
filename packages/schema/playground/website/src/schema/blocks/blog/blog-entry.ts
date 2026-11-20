import { defineBlock, defineField } from "@storyblok/schema";

import { blogFolder } from "../../folders";

export const blogEntryBlock = defineBlock({
  name: "blog_entry",
  display_name: "Blog Entry",
  is_root: true,
  is_nestable: false,
  folder: blogFolder,
  fields: [
    defineField("title", {
      description: "This field is used to render an H1 title",
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("excerpt", {
      description: "Displayed on the blog page.",
      display_name: "Preview Text",
      translatable: true,
      type: "textarea",
    }),
    defineField("preview_image", {
      description: "Displayed on the blog page. Should not contain any significant text.",
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("og_description", {
      description: "Displayed in social media link previews.",
      display_name: "Description",
      translatable: true,
      type: "textarea",
    }),
    defineField("og_image", {
      description:
        "Displayed in social media link previews. Can contain significant text such as the blog entry title.",
      display_name: "OG Image",
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
    defineField("noindex", {
      description: "Hide this entry from search engines and from the internal search",
      type: "boolean",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Blog Entry Body",
        },
      ],
      type: "bloks",
    }),
    defineField("tab-5c66dab0-9322-4171-9e13-224031243fcb", {
      display_name: "Content",
      keys: ["body"],
      type: "tab",
    }),
    defineField("tab-2586dfb6-775e-4464-a65d-80699fb28004", {
      display_name: "Details",
      keys: ["authors", "category"],
      type: "tab",
    }),
    defineField("authors", {
      filter_content_type: ["author"],
      folder_slug: "authors/",
      max_options: "4",
      source: "internal_stories",
      type: "options",
    }),
    defineField("category", {
      datasource: "blog-categories",
      required: true,
      source: "internal",
      type: "options",
    }),
  ],
});
