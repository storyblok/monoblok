import { defineBlock, defineField } from "@storyblok/schema";

import { appsFolder } from "../../folders";

export const appStoreBannerBlock = defineBlock({
  name: "app_store_banner",
  is_root: false,
  is_nestable: true,
  folder: appsFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/app_store_banner.png",
  fields: [
    defineField("tab-67aa7904-e29e-44ad-b0d0-f171d302bc82", {
      display_name: "Style",
      keys: ["background_color"],
      type: "tab",
    }),
    defineField("headline", {
      required: true,
      type: "text",
    }),
    defineField("description", {
      required: false,
      type: "richtext",
    }),
    defineField("image", {
      required: true,
      type: "asset",
    }),
    defineField("cta", {
      allow: ["enterprise_cta"],
      maximum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("background_color", {
      datasource: "lighter-colors-for-palette-plugin",
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
      required: false,
      source: "internal",
      type: "custom",
    }),
  ],
});
