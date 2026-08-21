import { defineBlock, defineField } from "@storyblok/schema";

export const featureCardBlock = defineBlock({
  name: "feature_card",
  is_nestable: true,
  preview_field: "title",
  fields: [
    defineField("title", { type: "text", max_length: 80, required: true }),
    defineField("description", { type: "textarea", max_length: 300 }),
    defineField("image", { type: "asset", filetypes: ["images"] }),
    defineField("icon", { type: "option", source: "internal", datasource: "icons" }),
    defineField("link", { type: "multilink" }),
    defineField("is_highlighted", { type: "boolean", inline_label: true }),
    defineField("highlight_color", {
      type: "text",
      max_length: 7,
      description: "Hex color code",
      // The editor hides a field when the rule matches, and an unchecked
      // boolean counts as empty: hidden until `is_highlighted` is on.
      conditional_settings: [
        {
          modifications: [{ display: "hide" }],
          rule_match: "all",
          rule_conditions: [
            {
              validated_object: {
                type: "field",
                field_key: "is_highlighted",
                field_attr: "value",
              },
              validation: "empty",
              value: null,
            },
          ],
        },
      ],
    }),
  ],
});
