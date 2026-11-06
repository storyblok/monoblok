import { defineBlock, defineField } from "@storyblok/schema";

import { configurationFolder } from "../../folders";

export const navigationCategoryItemBlock = defineBlock({
  name: "navigation_category_item",
  is_root: false,
  is_nestable: true,
  folder: configurationFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  preview_field: "display",
  fields: [
    defineField("display", {
      required: true,
      type: "text",
    }),
    defineField("link", {
      asset_link_type: true,
      email_link_type: true,
      required: true,
      show_anchor: true,
      type: "multilink",
    }),
    defineField("badge", {
      description: "This field adds a small, pill-shaped badge next to (after) the display text.",
      max_length: 24,
      type: "text",
    }),
    defineField("text", {
      required: true,
      type: "textarea",
    }),
    defineField("icon", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
  ],
});
