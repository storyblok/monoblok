import { defineBlock, defineField } from "@storyblok/schema";

export const textLogosLinksLogoBlock = defineBlock({
  name: "text_logos_links_logo",
  display_name: "Text Box with CTAs Logo (deprecated)",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock",
  image: "https://example.com/component-screenshots/text_logos_links_logo.png",
  fields: [
    defineField("image", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
  ],
});
