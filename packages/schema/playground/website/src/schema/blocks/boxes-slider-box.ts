import { defineBlock, defineField } from "@storyblok/schema";

export const boxesSliderBoxBlock = defineBlock({
  name: "boxes_slider_box",
  display_name: "Box",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/boxes_slider_box.png",
  preview_tmpl: "<div>{{it.headline}}</div>",
  fields: [
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
                field_key: "link",
                type: "field",
              },
              validation: "not_empty",
            },
            {
              validated_object: {
                field_attr: "value",
                field_key: "text",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "all",
        },
      ],
      type: "text",
    }),
    defineField("headline_icon", {
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
                field_key: "headline",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
      datasource: "lucide-icons",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("alternative_headline", {
      description:
        'DO NOT USE. It\'s an anti-pattern to have content only available on hover because many internet users do not have devices that trigger hover events.\n\n\nThe headline entered here will be made visible while hovering over the box. Can only be enabled after choosing "Portrait" as the image size from the "Style" tab in the Boxes Slider. Does not work for "Portrait Small" image size.',
      type: "text",
    }),
    defineField("subheadline", {
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
                field_key: "link",
                type: "field",
              },
              validation: "not_empty",
            },
            {
              validated_object: {
                field_attr: "value",
                field_key: "headline",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "all",
        },
      ],
      customize_toolbar: true,
      description:
        'This option will be ignored if "Portrait" or "Portrait Small" was chosen as the image size from the "Style" tab in the Boxes Slider.',
      toolbar: ["bold"],
      type: "richtext",
    }),
    defineField("image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("link", {
      type: "multilink",
    }),
    defineField("accent_color", {
      datasource: "dark-colors-for-palette-plugin",
      description:
        'This option will be ignored if "Portrait Images" was chosen as the image size from the "Style" tab in the Boxes Slider.',
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
    defineField("background_color", {
      datasource: "lighter-colors-for-palette-plugin",
      default_value: "None",
      display_name: "",
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
    defineField("tab-e13b8908-ad18-4f09-9b8e-52f6efeebdcb", {
      display_name: "Style",
      keys: ["background_color", "accent_color"],
      type: "tab",
    }),
  ],
});
