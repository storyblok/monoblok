import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const accordionCarouselBlock = defineBlock({
  name: "accordion_carousel",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/accordion_carousel.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("background_color", {
      datasource: "lightest-colors-for-palette-plugin",
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
    defineField("items", {
      allow: ["accordion_carousel_item"],
      minimum: 2,
      required: true,
      type: "bloks",
    }),
  ],
});
