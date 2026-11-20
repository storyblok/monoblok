import { defineBlock, defineField } from "@storyblok/schema";

export const bulletListItemBlock = defineBlock({
  name: "bullet_list_item",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  description: "This blok is meant to be used within the Bullet List blok.",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/bullet_list_item.png",
  preview_field: "text",
  fields: [
    defineField("icon", {
      datasource: "lucide-icons",
      exclude_empty_option: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("text", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "link"],
      type: "richtext",
    }),
  ],
});
