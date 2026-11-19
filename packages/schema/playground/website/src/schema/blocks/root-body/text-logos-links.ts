import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const textLogosLinksBlock = defineBlock({
  name: "text_logos_links",
  display_name: "Text Box with CTAs",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/text_logos_links.png",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("background_custom_color", {
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
    defineField("accent_custom_color", {
      datasource: "dark-colors-for-palette-plugin",
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
      default_value: " ",
      options: [
        {
          name: "Normal",
          value: " ",
        },
        {
          name: "Large",
          value: "large",
        },
      ],
      type: "option",
    }),
    defineField("padding", {
      default_value: "default",
      options: [
        {
          _uid: "cb7a3dbc-5937-4b2a-a966-7d01909772f6",
          name: "Default",
          value: "default",
        },
        {
          _uid: "ed5db791-d9c7-467c-826d-0eedf5e63a08",
          name: "Large",
          value: "large",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("image_size", {
      default_value: "default",
      display_name: "Image Size",
      options: [
        {
          _uid: "1b500f57-95cd-447f-9ab3-e8f32354d18c",
          name: "Default",
          value: "default",
        },
        {
          _uid: "b472ff12-fb98-4fce-8025-299ca29dbb3f",
          name: "Small (limited height)",
          value: "small",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("right_side_content", {
      default_value: "none",
      description: "Defines what is displayed on the right side.",
      options: [
        {
          _uid: "6319d323-d51d-4851-a3be-0437164728e7",
          name: "None",
          value: "none",
        },
        {
          _uid: "cae044b8-6064-43d3-84d1-9fd273465b28",
          name: "Image",
          value: "image",
        },
        {
          _uid: "c4923b6b-065c-45a5-b369-71c51f61882d",
          name: "Logos (deprecated)",
          value: "logos",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("image", {
      allow: ["image"],
      conditional_settings: [
        {
          modifications: [
            {
              required: true,
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "right_side_content",
                type: "field",
              },
              validation: "equals",
              value: "image",
            },
          ],
          rule_match: "any",
        },
      ],
      maximum: 1,
      type: "bloks",
    }),
    defineField("logos_groups", {
      allow: ["text_logos_links_group"],
      conditional_settings: [
        {
          modifications: [
            {
              required: true,
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "right_side_content",
                type: "field",
              },
              validation: "equals",
              value: "logos",
            },
          ],
          rule_match: "any",
        },
      ],
      description:
        "Please do not create new content using this feature. It does not conform to the current standards of the website's design.",
      display_name: "Logos Groups (deprecated)",
      maximum: 2,
      type: "bloks",
    }),
    defineField("subheadline", {
      translatable: true,
      type: "text",
    }),
    defineField("headline", {
      conditional_settings: [
        {
          modifications: [
            {
              required: true,
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "text",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
      description:
        "The following snippet colorizes the words that you put in between, according to the accent color defined in the Style tab: \n[color] some example words that are now colorized. [/color]",
      translatable: true,
      type: "text",
    }),
    defineField("text", {
      conditional_settings: [
        {
          modifications: [
            {
              required: true,
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "headline",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
      customize_toolbar: true,
      toolbar: [
        "bold",
        "list",
        "code",
        "inlinecode",
        "emoji",
        "h1",
        "h3",
        "h2",
        "h4",
        "unset",
        "image",
        "italic",
        "link",
        "olist",
        "strike",
        "subscript",
        "superscript",
        "paragraph",
      ],
      translatable: true,
      type: "richtext",
    }),
    defineField("cta", {
      allow: ["enterprise_cta"],
      display_name: "CTA",
      maximum: 2,
      type: "bloks",
    }),
    defineField("tab-b4908978-7bb5-47b3-b218-6b1b04b8f9bd", {
      display_name: "Right-side content",
      keys: ["image", "logos_groups", "right_side_content"],
      type: "tab",
    }),
    defineField("tab-52f4c6f5-6796-4fc2-9a99-401d9a24aadd", {
      display_name: "Style",
      keys: [
        "headline_size",
        "background_custom_color",
        "accent_custom_color",
        "padding",
        "image_size",
      ],
      type: "tab",
    }),
  ],
});
