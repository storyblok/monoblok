import { defineBlock, defineField } from "@storyblok/schema";

export const textLogosLinksGroupBlock = defineBlock({
  name: "text_logos_links_group",
  display_name: "Text Box with CTAs Logo Group (deprecated)",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock",
  image: "https://example.com/component-screenshots/text_logos_links_group.png",
  fields: [
    defineField("headline", {
      required: true,
      type: "text",
    }),
    defineField("logos", {
      allow: ["text_logos_links_logo"],
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("link_text", {
      required: true,
      type: "text",
    }),
    defineField("link", {
      required: true,
      type: "multilink",
    }),
  ],
});
