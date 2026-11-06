import { defineBlock, defineField } from "@storyblok/schema";

export const enterpriseSingleBoxImageBlock = defineBlock({
  name: "enterprise_single_box_image",
  display_name: "Single Box Image",
  is_root: false,
  is_nestable: true,
  image: "https://example.com/component-screenshots/enterprise_single_box_image.png",
  fields: [
    defineField("image", {
      filetypes: ["images"],
      type: "asset",
    }),
  ],
});
