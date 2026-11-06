import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const singlePricingBoxBlock = defineBlock({
  name: "single_pricing_box",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/single_pricing_box.png",
  preview_tmpl: "{{it.title}}",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("title", {
      required: true,
      type: "text",
    }),
    defineField("tab-07c08c5c-483e-415f-8743-713e0af121b1", {
      display_name: "Style",
      keys: ["accent_color"],
      type: "tab",
    }),
    defineField("subtitle", {
      required: true,
      type: "text",
    }),
    defineField("price", {
      required: true,
      type: "text",
    }),
    defineField("price_information", {
      description: "",
      required: true,
      type: "textarea",
    }),
    defineField("price_information_subtitle", {
      description:
        "Place two currency tags [currency] around the value where you want the site to inject the currency for you. Example [currency]9[currency]/month.",
      required: true,
      type: "text",
    }),
    defineField("cta_text", {
      type: "text",
    }),
    defineField("features", {
      description:
        "Place two currency tags [currency] around the value where you want the site to inject the currency for you. Example [currency]9[/currency]/month.",
      required: true,
      type: "textarea",
    }),
    defineField("accent_color", {
      datasource: "medium-colors-for-palette-plugin",
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
      required: true,
      source: "internal",
      type: "custom",
    }),
  ],
});
