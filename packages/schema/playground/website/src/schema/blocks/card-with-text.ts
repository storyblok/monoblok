import { defineBlock, defineField } from "@storyblok/schema";

export const cardWithTextBlock = defineBlock({
  name: "card_with_text",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/card_with_text.png",
  preview_tmpl: "{{it.title}}",
  fields: [
    defineField("decoration", {
      datasource: "decorations-list",
      description: "Is displayed on the top left corner of the card.",
      exclude_empty_option: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("title", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("description", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold"],
      translatable: true,
      type: "richtext",
    }),
    defineField("link", {
      email_link_type: true,
      required: true,
      translatable: true,
      type: "multilink",
    }),
    defineField("tab-6d291dcc-361f-430b-a251-fcb945dea96a", {
      display_name: "Style Options",
      keys: ["decoration", "accent_color"],
      type: "tab",
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
      source: "internal",
      type: "custom",
    }),
  ],
});
