import { defineBlock, defineField } from "@storyblok/schema";

export const contentBoardListItemBlock = defineBlock({
  name: "content_board_list_item",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/content_board_list_item.png",
  preview_field: "headline",
  fields: [
    defineField("icon", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("icon_alt", {
      type: "text",
    }),
    defineField("headline", {
      description: "Renders h3 or h4.",
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("description", {
      customize_toolbar: true,
      toolbar: ["italic", "bold", "unset"],
      translatable: true,
      type: "richtext",
    }),
    defineField("link", {
      required: false,
      translatable: true,
      type: "multilink",
    }),
    defineField("tab-ae64aadb-9c9e-4fbe-84f7-de6c99a8c7b9", {
      display_name: "Icon",
      keys: ["icon_src", "icon_alt", "icon"],
      type: "tab",
    }),
  ],
});
