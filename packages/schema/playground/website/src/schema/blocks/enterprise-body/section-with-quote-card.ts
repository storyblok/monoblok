import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const sectionWithQuoteCardBlock = defineBlock({
  name: "section_with_quote_card",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/section_with_quote_card.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("description", {
      customize_toolbar: true,
      required: true,
      style_options: [
        {
          _uid: "e52c7dd9-1fce-465f-b8a8-d28d523a347b",
          name: "Purple Color",
          value: "heading-emphasis-solid-purple",
        },
        {
          _uid: "4be2f6a9-0ba6-4965-8585-972f3460dcde",
          name: "Blue Color",
          value: "heading-emphasis-solid-blue",
        },
        {
          _uid: "c97699b5-68b3-43c5-ae7d-ceb34a539322",
          name: "Green Color",
          value: "heading-emphasis-solid-green",
        },
        {
          _uid: "cf75c79a-e32c-41fa-9949-1516be93ff35",
          name: "Yellow Color",
          value: "heading-emphasis-solid-yellow",
        },
        {
          _uid: "43b50868-eb5e-4e3d-8dd3-7163994582dc",
          name: "Orange Color",
          value: "heading-emphasis-solid-orange",
        },
        {
          _uid: "f616ef50-87b3-4072-a7dd-8fe98fe40648",
          name: "Red Color",
          value: "heading-emphasis-solid-red",
        },
      ],
      toolbar: ["bold", "hrule", "h2"],
      type: "richtext",
    }),
    defineField("quote_title", {
      required: true,
      type: "text",
    }),
    defineField("quote", {
      filter_content_type: ["new_quote"],
      required: true,
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
    defineField("decoration", {
      datasource: "decorations-list",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("background_color", {
      datasource: "light-colors-for-palette-plugin",
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
    defineField("ctas", {
      allow: ["enterprise_cta"],
      display_name: "CTAs",
      maximum: 1,
      type: "bloks",
    }),
  ],
});
