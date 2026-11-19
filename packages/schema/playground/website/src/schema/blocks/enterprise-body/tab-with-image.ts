import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const tabWithImageBlock = defineBlock({
  name: "tab_with_image",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/tab_with_image.png",
  fields: [
    defineField("name", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("image", {
      required: true,
      type: "asset",
    }),
  ],
});
