import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseSingleBoxBlock = defineBlock({
  name: "enterprise_single_box",
  display_name: "Single Box",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_single_box.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("images", {
      allow: ["enterprise_single_box_image"],
      maximum: 10,
      type: "bloks",
    }),
    defineField("headline", {
      translatable: true,
      type: "text",
    }),
    defineField("image_size", {
      default_value: "default",
      options: [
        {
          name: "Default",
          value: "default",
        },
        {
          name: "Big",
          value: "big",
        },
        {
          name: "Small",
          value: "small",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("content_alignment", {
      options: [
        {
          name: "Center",
          value: "center",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("content", {
      customize_toolbar: true,
      toolbar: [
        "bold",
        "list",
        "unset",
        "italic",
        "link",
        "paragraph",
        "olist",
        "quote",
        "underline",
      ],
      type: "richtext",
    }),
    defineField("tab-7a86467f-3d27-41ef-b8c5-59b34a6c21e5", {
      display_name: "Options",
      keys: ["image_size", "content_alignment"],
      type: "tab",
    }),
  ],
});
