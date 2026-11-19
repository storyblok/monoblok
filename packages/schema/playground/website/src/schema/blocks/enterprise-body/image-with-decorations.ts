import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const imageWithDecorationsBlock = defineBlock({
  name: "image_with_decorations",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/image_with_decorations.png",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body"],
  fields: [
    defineField("image", {
      required: true,
      type: "asset",
    }),
    defineField("decorations", {
      datasource: "decorations-list",
      default_value: '["attention_top"]',
      exclude_empty_option: true,
      max_options: "2",
      min_options: "1",
      options: [
        {
          _uid: "dee444e3-7ee9-42a4-9ea6-5aae2be61aa7",
          name: "Swirl top",
          value: "swirl_top",
        },
        {
          _uid: "edd0f7b7-88ed-4f43-8872-d5c069287c97",
          name: "Attention top",
          value: "attention_top",
        },
        {
          _uid: "fcaa5a9f-d764-4587-9282-4c0144aee10f",
          name: "Attention Bottom",
          value: "attention_bottom",
        },
        {
          _uid: "92d7a31f-41dc-4b78-bdc6-6535e22fad42",
          name: "Stars bottom",
          value: "stars_bottom",
        },
      ],
      required: true,
      type: "options",
    }),
    defineField("rotate", {
      description: "If switched on, the image will be rotated 2 degrees counter-clockwise.",
      type: "boolean",
    }),
  ],
});
