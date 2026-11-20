import { defineBlock, defineField } from "@storyblok/schema";

export const actionBoxItemBlock = defineBlock({
  name: "action_box_item",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/action_box_item.png",
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("icon", {
      datasource: "lucide-icons",
      default_value: "rocket",
      exclude_empty_option: true,
      required: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("text", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold"],
      type: "richtext",
    }),
  ],
});
