import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const textQuotesIllustrationBlock = defineBlock({
  name: "text_quotes_illustration",
  display_name: "Text, Quotes and Illustration (deprecated)",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock",
  image: "https://example.com/component-screenshots/text_quotes_illustration.png",
  preview_tmpl:
    "<div>{{sub_headline}}</div>\n<strong>{{headline}}</strong>\n<div>Illustration: {{illustration}}</div>",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("background_color", {
      default_value: " ",
      options: [
        {
          name: "Transparent",
          value: " ",
        },
        {
          name: "Custom",
          value: "custom",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("custom_background_color", {
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
                field_key: "background_color",
                type: "field",
              },
              validation: "not_equals",
              value: "custom",
            },
          ],
          rule_match: "any",
        },
      ],
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
    defineField("accent_color", {
      default_value: " ",
      options: [
        {
          name: "Default",
          value: " ",
        },
        {
          name: "Custom",
          value: "custom",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("custom_accent_color", {
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
                field_key: "accent_color",
                type: "field",
              },
              validation: "not_equals",
              value: "custom",
            },
          ],
          rule_match: "any",
        },
      ],
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
    defineField("background_decoration", {
      default_value: " ",
      options: [
        {
          _uid: "84e7c331-6272-48f8-b8f3-f3299020f9e7",
          name: "None",
          value: " ",
        },
        {
          _uid: "10e7c996-b750-4ed3-bf49-ead8c128ac6c",
          name: "Circle",
          value: "circle",
        },
        {
          _uid: "f6281e41-d64a-4eb0-b4e1-1f50a6f2cc6e",
          name: "Vertically Centered Circle",
          value: "circle-vertically-centered",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("spacing_size", {
      default_value: " ",
      options: [
        {
          name: "Small",
          value: "small",
        },
        {
          name: "Medium",
          value: "medium",
        },
        {
          name: "Large",
          value: " ",
        },
      ],
      type: "option",
    }),
    defineField("compact", {
      description:
        "Removes the spacing at the top and at the bottom when multiple blocks of the same type are piled",
      type: "boolean",
    }),
    defineField("video_url", {
      description: "Must be a youtube embed url:\nhttps://www.youtube.com/embed/PUT_VIDEO_ID_HERE",
      regex: "^https:\\/\\/www\\.youtube\\.com\\/embed\\/[\\w-]{11}(\\?[\\w&=-]*)?$",
      type: "text",
    }),
    defineField("illustration_size", {
      default_value: " ",
      options: [
        {
          name: "Medium",
          value: " ",
        },
        {
          name: "Large",
          value: "large",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("illustration_side", {
      options: [
        {
          name: "Left",
          value: "left",
        },
        {
          name: "Right",
          value: "right",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("custom_illustration", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("sub_headline", {
      type: "text",
    }),
    defineField("headline", {
      description:
        "Wrap your text with [color][/color] to apply the accent color to it. Es: Redefine [color]Fast[/color]",
      required: true,
      type: "textarea",
    }),
    defineField("text", {
      allow_target_blank: true,
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "list", "link"],
      type: "richtext",
    }),
    defineField("ctas", {
      allow: ["text_quotes_illustration_link"],
      maximum: 2,
      type: "bloks",
    }),
    defineField("tab-0d06fb5d-83f0-4cd9-9a51-218b9dcbedf0", {
      display_name: "Illustration",
      keys: ["position", "illustration_side", "custom_illustration", "illustration_size"],
      type: "tab",
    }),
    defineField("quotes", {
      filter_content_type: ["new_quote"],
      source: "internal_stories",
      type: "options",
    }),
    defineField("tab-9e4092c3-1713-4fc1-9637-3106c25b0f1e", {
      display_name: "Style",
      keys: [
        "background_color",
        "accent_color",
        "background_decoration",
        "compact",
        "spacing_size",
        "custom_background_color",
        "custom_accent_color",
      ],
      type: "tab",
    }),
  ],
});
