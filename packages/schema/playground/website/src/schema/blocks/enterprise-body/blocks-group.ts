import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const blocksGroupBlock = defineBlock({
  name: "blocks_group",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/blocks_group.png",
  preview_tmpl:
    "{{@if(it.blocks.length &gt; 0)}}\n<div>\n{{@if(it.blocks.length == 1)}}\n{{it.blocks.length}} blok\n{{#else}}\n{{it.blocks.length}} bloks\n{{/if}}\n</div>\n{{/if}}\n",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("background_color_from_plugin", {
      datasource: "lighter-colors-for-palette-plugin",
      display_name: "Background Color",
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
    defineField("background_image", {
      conditional_settings: [
        {
          modifications: [{}],
          rule_conditions: [{}],
          rule_match: "any",
        },
      ],
      datasource: "shapes",
      description:
        "The background image is white and will only be visible when background color is set.",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("background_image_alignment", {
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
                field_key: "background_image",
                type: "field",
              },
              validation: "not_empty",
            },
          ],
          rule_match: "any",
        },
      ],
      default_value: "",
      description: "",
      options: [
        {
          _uid: "7600fc71-2bb2-443a-b013-64de29b31220",
          name: "Top right",
          value: "top-right",
        },
        {
          _uid: "3d7e45e5-0172-4117-87da-b467f5cbc176",
          name: "Top left",
          value: "top-left",
        },
        {
          _uid: "c33f382a-0312-4975-8161-18cdc5d7238a",
          name: "Bottom right",
          value: "bottom-right",
        },
        {
          _uid: "c18d2fe6-2e22-4f09-8c5a-415070222753",
          name: "Bottom left",
          value: "bottom-left",
        },
      ],
      required: false,
      type: "option",
      use_uuid: true,
    }),
    defineField("shape_variant", {
      options: [
        {
          _uid: "aa32e44d-9682-46bd-8395-f278f7a18897",
          name: "Regular",
          value: "",
        },
        {
          _uid: "fe0b1ff2-676e-430c-970c-7467582a462c",
          name: "Rounded corners",
          value: "rounded-corners",
        },
      ],
      required: false,
      type: "option",
      use_uuid: true,
    }),
    defineField("content_width", {
      default_value: " ",
      options: [
        {
          _uid: "2bcdfde2-a46b-482f-bca1-a808e9a03c23",
          name: "Full width",
          value: " ",
        },
        {
          _uid: "b037f1ee-f26e-4a14-8809-f5b3c3593305",
          name: "Medium Large",
          value: "medium-large",
        },
        {
          _uid: "e333fa7f-6021-4ca2-ad1b-ce6902d2417d",
          name: "Medium",
          value: "medium",
        },
        {
          _uid: "7ea3b0e7-9175-44ff-bf83-9b9be9cfc71e",
          name: "Small",
          value: "small",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("spacing", {
      default_value: "small",
      description: "Padding top and bottom of the group",
      options: [
        {
          name: "Small",
          value: "small",
        },
        {
          name: "Large",
          value: "large",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("blocks", {
      allow: [
        {
          tag: "Whitelist: Enterprise Body",
        },
      ],
      type: "bloks",
    }),
    defineField("tab-bf63e2d8-f1d5-4b70-802c-43f92ba4d52a", {
      display_name: "Style",
      keys: [
        "content_width",
        "top_bottom_spacings",
        "spacing",
        "background_color_from_palette",
        "background_image",
        "background_image_alignment",
        "background_color_from_plugin",
        "shape_variant",
      ],
      type: "tab",
    }),
  ],
});
