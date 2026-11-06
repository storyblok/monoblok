import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const customRichtextBlock = defineBlock({
  name: "custom_richtext",
  display_name: "Richtext Blok",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/custom_richtext.png",
  preview_field: "richtext",
  tags: ["Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("richtext", {
      allow: ["table", "codeblock", "video", "hint", "image", "annotated_image"],
      allow_custom_attributes: false,
      allow_target_blank: true,
      customize_toolbar: true,
      description: "",
      max_length: "",
      style_options: [
        {
          _uid: "a4443811-2123-4809-8e02-00f90bc7960d",
          name: "codeblock__title",
          value: "codeblock__title",
        },
        {
          _uid: "f260eb7f-f44f-4ee6-8f1e-851379d00680",
          name: "marker",
          value: "marker",
        },
        {
          _uid: "85915029-13d5-4545-a23e-e32e727b929b",
          name: "ui__label",
          value: "ui__label",
        },
      ],
      toolbar: [
        "bold",
        "italic",
        "strike",
        "underline",
        "paragraph",
        "h2",
        "h3",
        "h4",
        "h5",
        "paste",
        "blok",
        "image",
        "link",
        "hrule",
        "quote",
        "olist",
        "list",
        "h6",
        "inlinecode",
        "subscript",
        "superscript",
        "emoji",
        "unset",
      ],
      translatable: true,
      type: "richtext",
    }),
  ],
});
