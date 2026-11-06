import { defineBlock, defineField } from "@storyblok/schema";

export const roadmapCategoryBlock = defineBlock({
  name: "roadmap_category",
  is_root: false,
  is_nestable: true,
  image: "https://example.com/component-screenshots/roadmap_category.png",
  fields: [
    defineField("name", {
      translatable: true,
      type: "text",
    }),
    defineField("items", {
      filter_content_type: ["feature_item"],
      folder_slug: "fi/",
      source: "internal_stories",
      type: "options",
    }),
  ],
});
