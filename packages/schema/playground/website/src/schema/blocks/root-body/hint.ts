import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const hintBlock = defineBlock({
  name: "hint",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/hint.png",
  preview_field: "text",
  tags: ["Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("type", {
      exclude_empty_option: true,
      options: [
        {
          _uid: "bccdf84a-c716-4696-973e-71688759be34",
          name: "Hint",
          value: "hint",
        },
        {
          _uid: "69f3ea02-ef23-4b4e-a76c-df9425ed9c6f",
          name: "Learn",
          value: "learn",
        },
        {
          _uid: "15bc7be7-d020-42e9-b621-44cbe5e3c686",
          name: "Required",
          value: "required",
        },
        {
          _uid: "88df6d47-a4ad-453e-9975-c6e428cddc5a",
          name: "Caution",
          value: "warn",
        },
        {
          _uid: "7aff5f2c-643a-4a73-b317-e59032674ce2",
          name: "Quote",
          value: "quote",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("text", {
      customize_toolbar: true,
      required: true,
      toolbar: [
        "bold",
        "list",
        "inlinecode",
        "italic",
        "link",
        "olist",
        "strike",
        "superscript",
        "subscript",
        "emoji",
        "unset",
      ],
      translatable: true,
      type: "richtext",
    }),
    defineField("label", {
      description: "If left blank, the hint's type will be used as the label.",
      translatable: true,
      type: "text",
    }),
  ],
});
