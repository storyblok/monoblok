import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const ctaImageBlock = defineBlock({
  name: "cta_image",
  display_name: "CTA with Image",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/cta_image.png",
  preview_tmpl: "{{@if(it.cta[0]?.text)}}\n{{it.cta[0]?.text}}\n{{/if}}",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("text_color", {
      default_value: "white",
      options: [
        {
          name: "Dark",
          value: "dark",
        },
        {
          name: "White",
          value: "white",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("background_color_light", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "text_color",
                type: "field",
              },
              validation: "equals",
              value: "white",
            },
          ],
          rule_match: "any",
        },
      ],
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
      use_uuid: true,
    }),
    defineField("background_color_dark", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "text_color",
                type: "field",
              },
              validation: "not_equals",
              value: "white",
            },
          ],
          rule_match: "any",
        },
      ],
      datasource: "dark-colors-for-palette-plugin-cardwithtext-only",
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
      use_uuid: true,
    }),
    defineField("image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("tab-0276cbb4-d844-46b0-8776-5ce57df96944", {
      display_name: "Style",
      keys: ["text_color", "background_color_light", "background_color_dark"],
      type: "tab",
    }),
    defineField("content", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "h2", "italic", "paragraph", "unset"],
      type: "richtext",
    }),
    defineField("cta", {
      allow: ["enterprise_cta"],
      type: "bloks",
    }),
  ],
});
