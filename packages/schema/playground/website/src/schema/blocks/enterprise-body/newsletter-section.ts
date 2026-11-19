import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const newsletterSectionBlock = defineBlock({
  name: "newsletter_section",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/newsletter_section.png",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("text", {
      customize_toolbar: true,
      toolbar: ["bold", "italic", "strike", "underline", "paragraph"],
      type: "richtext",
    }),
    defineField("tab-456d9644-c7bd-4005-b211-1ceb7d383505", {
      display_name: "Options",
      keys: ["default_list", "headline_size", "background"],
      type: "tab",
    }),
    defineField("background", {
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
    defineField("headline_size", {
      default_value: "normal",
      options: [
        {
          name: "Normal",
          value: "normal",
        },
        {
          name: "Big",
          value: "big",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
  ],
});
