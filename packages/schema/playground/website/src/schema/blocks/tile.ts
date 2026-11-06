import { defineBlock, defineField } from "@storyblok/schema";

export const tileBlock = defineBlock({
  name: "tile",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/tile.png",
  preview_tmpl:
    "<div>{{@if(it.width)}}\n{{it.width}}%\n{{#else}}\n50%\n{{/if}}</div>\n{{@image(it.image.filename)/}}",
  fields: [
    defineField("width", {
      default_value: "50",
      options: [
        {
          _uid: "eefe2a1c-5737-4bef-8e4f-3f7a2833fd66",
          name: "100%",
          value: "100",
        },
        {
          _uid: "0054a2b7-beec-4c88-913a-0096a2a610ba",
          name: "50%",
          value: "50",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("layout_width_50", {
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
                field_key: "width",
                type: "field",
              },
              validation: "not_empty",
            },
            {
              validated_object: {
                field_attr: "value",
                field_key: "width",
                type: "field",
              },
              validation: "not_equals",
              value: "50",
            },
          ],
          rule_match: "all",
        },
      ],
      default_value: "title_image_description",
      display_name: "Layout",
      options: [
        {
          _uid: "bf4ea1ce-a0a5-4094-a430-09cf8b995912",
          name: "Title, image, description",
          value: "title_image_description",
        },
        {
          _uid: "b1a198f2-5f4a-462b-aa66-d6f0b024c3d7",
          name: "Image, title, description",
          value: "image_title_description",
        },
        {
          _uid: "18b80b04-e52e-4717-b199-7b61e7c65c8a",
          name: "Title, description, image",
          value: "title_description_image",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("layout_width_100", {
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
                field_key: "width",
                type: "field",
              },
              validation: "empty",
            },
            {
              validated_object: {
                field_attr: "value",
                field_key: "width",
                type: "field",
              },
              validation: "not_equals",
              value: "100",
            },
          ],
          rule_match: "any",
        },
      ],
      default_value: "image_right",
      display_name: "Layout",
      options: [
        {
          _uid: "6df73c0f-7e41-4285-ba09-0220cbb6c90a",
          name: "Image right",
          value: "image_right",
        },
        {
          _uid: "7f682017-4059-41f4-83cb-554f47f37ac4",
          name: "Image left",
          value: "image_left",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("relative_max_image_width", {
      decimals: 0,
      default_value: "100",
      description: "",
      display_name: "Relative Max Image Width (%)",
      max_value: 100,
      min_value: 0,
      steps: 1,
      type: "number",
    }),
    defineField("align_image_to_tile_edge", {
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
                field_key: "width",
                type: "field",
              },
              validation: "equals",
              value: "50",
            },
            {
              validated_object: {
                field_attr: "value",
                field_key: "layout_width_50",
                type: "field",
              },
              validation: "equals",
              value: "title_image_description",
            },
          ],
          rule_match: "all",
        },
      ],
      type: "boolean",
    }),
    defineField("background_color", {
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
    defineField("title", {
      customize_toolbar: true,
      description: "Please make sure to choose the appropriate Heading level.",
      required: true,
      style_options: [
        {
          _uid: "1f3992fb-54e6-4fb6-a07e-06214aec0fd5",
          name: "Color Purple",
          value: "heading-emphasis-solid-purple",
        },
        {
          _uid: "d5016b04-dfd6-435d-8d2e-516e31042882",
          name: "Color Blue",
          value: "heading-emphasis-solid-blue",
        },
        {
          _uid: "ddef5e43-5665-4e8c-9072-45a4baef18c0",
          name: "Color Green",
          value: "heading-emphasis-solid-green",
        },
        {
          _uid: "d656cb98-19db-4f11-838e-c56c529f6fb9",
          name: "Color Yellow",
          value: "heading-emphasis-solid-yellow",
        },
        {
          _uid: "ab585b39-1cab-4ad9-afb1-af32929f8385",
          name: "Color Orange",
          value: "heading-emphasis-solid-orange",
        },
        {
          _uid: "18b0c06a-b828-4793-bc83-20974cb2fcd9",
          name: "Color Red",
          value: "heading-emphasis-solid-red",
        },
      ],
      toolbar: ["h2", "italic", "subscript", "superscript", "strike", "h3"],
      type: "richtext",
    }),
    defineField("image", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("description", {
      customize_toolbar: true,
      required: true,
      toolbar: [
        "italic",
        "bold",
        "h3",
        "h4",
        "olist",
        "subscript",
        "superscript",
        "strike",
        "list",
        "unset",
      ],
      type: "richtext",
    }),
    defineField("link", {
      type: "multilink",
    }),
    defineField("tab-0dcf2f2a-c63b-43f6-8431-24fa7a3d7b1b", {
      display_name: "Style",
      keys: [
        "background_color",
        "width",
        "layout_width_50",
        "layout_width_100",
        "align_image_to_tile_edge",
        "relative_image_width",
        "relative_max_image_width",
      ],
      type: "tab",
    }),
  ],
});
