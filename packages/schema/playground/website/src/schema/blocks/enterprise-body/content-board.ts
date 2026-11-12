import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const contentBoardBlock = defineBlock({
  name: "content_board",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/content_board.png",
  preview_tmpl: "{{it.headline}}",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("subheadline", {
      type: "text",
    }),
    defineField("headline", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("text", {
      allow: ["codeblock"],
      customize_toolbar: true,
      toolbar: [
        "bold",
        "list",
        "inlinecode",
        "h3",
        "italic",
        "link",
        "olist",
        "strike",
        "subscript",
        "superscript",
        "blok",
      ],
      translatable: true,
      type: "richtext",
    }),
    defineField("image", {
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
    defineField("list", {
      allow: ["content_board_list_item"],
      type: "bloks",
    }),
    defineField("lists", {
      allow: ["content_board_list"],
      type: "bloks",
    }),
    defineField("icons_size", {
      default_value: " ",
      options: [
        {
          name: "Small",
          value: " ",
        },
        {
          name: "Medium",
          value: "medium",
        },
      ],
      type: "option",
    }),
    defineField("hide_box", {
      type: "boolean",
    }),
    defineField("sub_headline_font_style", {
      default_value: "normal",
      options: [
        {
          _uid: "cc00e324-8310-4c75-a485-10829ffec8aa",
          name: "Normal",
          value: "normal",
        },
        {
          _uid: "ac6001dd-4f0e-4dcb-b6f2-1a73e9c2c523",
          name: "Italic",
          value: "italic",
        },
        {
          _uid: "b30e36fa-5693-4672-9040-ce1488f79680",
          name: "Bold",
          value: "bold",
        },
      ],
      type: "options",
    }),
    defineField("tab-fcd6f540-b745-42ca-be80-e7bf9b8b3f4a", {
      display_name: "Lists",
      keys: ["boards", "lists"],
      type: "tab",
    }),
    defineField("tab-087ebd47-d013-451f-b39b-942ab594a2b9", {
      display_name: "Style",
      keys: ["background", "icons_size", "hide_box", "sub_headline_font_style", "accent_color"],
      type: "tab",
    }),
    defineField("background", {
      options: [
        {
          name: "Grey",
          value: "",
        },
        {
          name: "Transparent",
          value: "transparent",
        },
      ],
      type: "option",
      use_uuid: true,
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
  ],
});
