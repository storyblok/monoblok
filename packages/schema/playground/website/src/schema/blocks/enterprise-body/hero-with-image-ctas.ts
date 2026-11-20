import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const heroWithImageCtasBlock = defineBlock({
  name: "hero_with_image_ctas",
  display_name: "Hero with image and CTAs",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/hero_with_image_ctas.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("text", {
      customize_toolbar: true,
      required: true,
      style_options: [
        {
          _uid: "e96522f1-6912-496c-bc91-d27b85aa61f4",
          name: "emphasis solid purple",
          value: "heading-emphasis-solid-purple",
        },
        {
          _uid: "f8107738-4429-4320-85ad-384cecc8040c",
          name: "emphasis solid blue",
          value: "heading-emphasis-solid-blue",
        },
        {
          _uid: "92621e1b-d624-4932-ab09-286672d6c9ad",
          name: "emphasis solid green",
          value: "heading-emphasis-solid-green",
        },
        {
          _uid: "6c3bf6ef-2a82-4f4a-98f1-c8705b0c5b1c",
          name: "emphasis solid yellow",
          value: "heading-emphasis-solid-yellow",
        },
        {
          _uid: "5bd61df9-8b7a-47e7-93d0-bd16ab5cfa56",
          name: "emphasis solid orange",
          value: "heading-emphasis-solid-orange",
        },
        {
          _uid: "a3fd153f-0fe1-421f-939f-ca683db466c1",
          name: "emphasis solid red",
          value: "heading-emphasis-solid-red",
        },
        {
          _uid: "6436c255-efb4-45af-8a47-75fc5b0a7e48",
          name: "Emphasis gradient purple",
          value: "heading-emphasis-gradient-purple",
        },
        {
          _uid: "4ed5a52b-0125-4399-a815-b324a6b7ff28",
          name: "Emphasis gradient blue",
          value: "heading-emphasis-gradient-blue",
        },
        {
          _uid: "5888090f-c556-47e1-b54b-14ed343f7b1a",
          name: "Emphasis gradient green",
          value: "heading-emphasis-gradient-green",
        },
        {
          _uid: "5888090f-c556-47e1-b54b-14ed343f7b1a",
          name: "Emphasis gradient yellow",
          value: "heading-emphasis-gradient-yellow",
        },
        {
          _uid: "e71643ea-c756-4cc9-b20c-d0ec83d10a41",
          name: "Emphasis gradient orange",
          value: "heading-emphasis-gradient-orange",
        },
        {
          _uid: "9f2d9b7f-d98a-4f77-9808-a34100ba241d",
          name: "Emphasis gradient red",
          value: "heading-emphasis-gradient-red",
        },
      ],
      toolbar: ["bold", "h1", "superscript", "image", "h2", "unset"],
      type: "richtext",
    }),
    defineField("image", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("quote", {
      filter_content_type: ["new_quote"],
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
    defineField("shape", {
      datasource: "shapes",
      exclude_empty_option: true,
      required: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("shape_colour", {
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
      source: "internal",
      type: "custom",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      maximum: 2,
      type: "bloks",
    }),
    defineField("decorations", {
      exclude_empty_option: false,
      options: [
        {
          _uid: "c7285a55-21b2-492d-b1f7-3a3ebb167912",
          name: "Swirl top",
          value: "swirl_top",
        },
        {
          _uid: "0697e731-c1d6-480f-bded-e82fa4b34cc3",
          name: "Attention top",
          value: "attention_top",
        },
        {
          _uid: "2b6609b5-27f7-4fa8-b537-5efe2a15b185",
          name: "Attention bottom",
          value: "attention_bottom",
        },
        {
          _uid: "26efa5c4-fb59-41f5-8bb1-ae9dc053a7ec",
          name: "Stars bottom",
          value: "stars_bottom",
        },
      ],
      type: "options",
      use_uuid: true,
    }),
  ],
});
