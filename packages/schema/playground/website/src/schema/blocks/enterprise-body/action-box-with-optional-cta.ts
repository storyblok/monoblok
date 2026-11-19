import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const actionBoxWithOptionalCtaBlock = defineBlock({
  name: "action_box_with_optional_cta",
  display_name: "Action Box with Optional CTA",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/action_box_with_optional_cta.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      required: false,
      type: "text",
    }),
    defineField("subheadline", {
      required: false,
      type: "textarea",
    }),
    defineField("accent_color", {
      datasource: "light-colors-for-palette-plugin",
      description:
        "Allows the choice of a custom color for icons and decoration, to override their default color. ",
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
    defineField("action_items", {
      allow: ["action_box_item"],
      maximum: 4,
      minimum: 2,
      required: true,
      type: "bloks",
    }),
    defineField("cta", {
      allow: ["enterprise_cta"],
      maximum: 1,
      type: "bloks",
    }),
  ],
});
