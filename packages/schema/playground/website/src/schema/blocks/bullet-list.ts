import { defineBlock, defineField } from "@storyblok/schema";

export const bulletListBlock = defineBlock({
  name: "bullet_list",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/bullet_list.png",
  fields: [
    defineField("headline_alignment", {
      default_value: "no_divider",
      description:
        "Positions headline above, below, or without a divider, should a headline be present.",
      exclude_empty_option: true,
      options: [
        {
          _uid: "a38f0026-4c21-4854-aead-cd4a15f895bf",
          name: "Above divider",
          value: "above_divider",
        },
        {
          _uid: "1e023fc0-f38f-4873-8a2e-405b2aab989f",
          name: "Below divider",
          value: "below_divider",
        },
        {
          _uid: "fa097461-4b88-4b99-894c-23de283a2608",
          name: "No divider",
          value: "no_divider",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("headline", {
      required: false,
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
      exclude_empty_option: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("bullet_points", {
      allow: ["bullet_list_item"],
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("accent_color", {
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
    defineField("tab-7ff9b4f3-8da5-403b-a41c-ebcf2f1c7b14", {
      display_name: "Style Options",
      keys: ["headline_alignment", "accent_color"],
      type: "tab",
    }),
  ],
});
