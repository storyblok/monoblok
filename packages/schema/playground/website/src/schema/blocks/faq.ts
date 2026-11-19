import { defineBlock, defineField } from "@storyblok/schema";

export const faqBlock = defineBlock({
  name: "faq",
  display_name: "FAQ",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", {
      description: "This field is used to render an H1 title",
      required: true,
      translatable: true,
      type: "text",
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
    defineField("noindex", {
      description: "Hide this entry from search engines and from the internal search",
      display_name: "NoIndex",
      type: "boolean",
    }),
    defineField("categories", {
      datasource: "faq-categories",
      exclude_empty_option: true,
      source: "internal",
      type: "options",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Root Body",
        },
      ],
      type: "bloks",
    }),
    defineField("tab-08146847-68c2-49db-bcde-5eb8aad789b2", {
      display_name: "Content",
      keys: ["categories", "body"],
      type: "tab",
    }),
  ],
});
