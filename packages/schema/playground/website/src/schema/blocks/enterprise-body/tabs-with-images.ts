import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const tabsWithImagesBlock = defineBlock({
  name: "tabs_with_images",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/tabs_with_images.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("tabs", {
      allow: ["tab_with_image"],
      required: true,
      type: "bloks",
    }),
    defineField("background_color", {
      field_type: "native-color-picker",
      options: [
        {
          _uid: "cbd056a9-3512-47be-a41f-f0c1759d6553",
          name: "size",
          value: "small",
        },
        {
          _uid: "1964fe7f-aad2-4b0b-bada-88de935b06db",
          name: "defaultValue",
          value: "#F7F9FC",
        },
        {
          _uid: "55a2a8c4-6610-4c7d-8029-b24dd01f8174",
          name: "colors",
          value: '["#F7F9FC", "#F3F6FF", "#FFF8EE", "#F3FFF6"]',
        },
      ],
      required: true,
      required_fields: "",
      type: "custom",
    }),
  ],
});
