import { defineBlock, defineField } from "@storyblok/schema";

export const contentBoardListBlock = defineBlock({
  name: "content_board_list",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/content_board_list.png",
  fields: [
    defineField("headline", {
      translatable: true,
      type: "text",
    }),
    defineField("text", {
      translatable: true,
      type: "textarea",
    }),
    defineField("tab-9f6f5668-69b3-4a8d-89e0-acf773c62d33", {
      display_name: "Styling",
      keys: ["accent_color"],
      type: "tab",
    }),
    defineField("accent_color", {
      datasource: "dark-colors-for-palette-plugin",
      field_type: "native-color-picker",
      options: [
        {
          name: "size",
          value: "",
        },
        {
          name: "defaultValue",
          value: "",
        },
        {
          name: "colors",
          value: "",
        },
      ],
      source: "internal",
      type: "custom",
    }),
    defineField("items", {
      allow: ["content_board_list_item"],
      type: "bloks",
    }),
  ],
});
