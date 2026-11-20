import { defineBlock, defineField } from "@storyblok/schema";

export const targetedPageBlock = defineBlock({
  name: "targeted_page",
  display_name: "Tutorial",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", {
      description: "This field is used to render an H1 title",
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("teaser", {
      max_length: "77",
      translatable: true,
      type: "textarea",
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
      type: "boolean",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Root Body",
        },
      ],
      type: "bloks",
    }),
    defineField("tab-16603195-5829-4fbc-b043-bb4b9458e6e1", {
      display_name: "Content",
      keys: ["body"],
      type: "tab",
    }),
    defineField("tab-2586dfb6-775e-4464-a65d-80699fb28004", {
      display_name: "Settings",
      keys: [
        "authors",
        "tech",
        "beginner",
        "is_gated_content",
        "category",
        "preview_image",
        "hide_date",
        "topics",
      ],
      type: "tab",
    }),
    defineField("tech", {
      datasource: "technologies",
      description:
        'Select "None" if your article is just about Storyblok or in case it\'s not about a specific tech. We are not allowing this field empty just to make sure nobody forgets :-) ',
      options: [
        {
          name: "nuxt",
          value: "nuxt",
        },
        {
          name: "next",
          value: "next",
        },
        {
          name: "js",
          value: "js",
        },
        {
          name: "ruby",
          value: "ruby",
        },
        {
          name: "php",
          value: "php",
        },
        {
          name: "general",
          value: "general",
        },
        {
          name: "python",
          value: "python",
        },
        {
          name: "vue",
          value: "vue",
        },
        {
          name: "react",
          value: "react",
        },
        {
          name: "angular",
          value: "angular",
        },
        {
          name: "storyblok",
          value: "storyblok",
        },
        {
          name: "amp",
          value: "amp",
        },
        {
          name: "app",
          value: "app",
        },
        {
          name: "oauth",
          value: "oauth",
        },
        {
          name: "vuedose",
          value: "vuedose",
        },
      ],
      required: true,
      source: "internal",
      type: "options",
    }),
    defineField("topics", {
      datasource: "tutorials-topics",
      source: "internal",
      type: "options",
    }),
    defineField("authors", {
      filter_content_type: ["author"],
      folder_slug: "authors/",
      max_options: 4,
      source: "internal_stories",
      type: "options",
    }),
    defineField("hide_date", {
      type: "boolean",
    }),
  ],
});
