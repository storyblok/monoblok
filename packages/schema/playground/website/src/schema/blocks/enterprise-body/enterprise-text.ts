import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseTextBlock = defineBlock({
  name: "enterprise_text",
  display_name: "Text Section",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_text.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("content", {
      customize_toolbar: true,
      toolbar: [
        "inlinecode",
        "list",
        "bold",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "italic",
        "link",
        "olist",
        "subscript",
        "strike",
        "superscript",
        "unset",
      ],
      translatable: true,
      type: "richtext",
    }),
    defineField("tab-3c3c4fd4-0b28-40b7-8cc0-59ff34cb7d2c", {
      display_name: "Style",
      keys: ["text_alignment", "wide_layout", "layout", "content_width"],
      type: "tab",
    }),
    defineField("text_alignment", {
      options: [
        {
          name: "Center",
          value: "center",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("content_width", {
      default_value: " ",
      options: [
        {
          name: "Large",
          value: "large",
        },
        {
          name: "Small",
          value: " ",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
  ],
});
