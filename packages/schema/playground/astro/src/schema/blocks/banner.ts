import { defineBlock, defineField } from "@storyblok/schema";

import { headlineField } from "../fields";

export const bannerBlock = defineBlock({
  name: "banner",
  is_nestable: true,
  fields: [
    { ...headlineField, required: true },
    defineField("subline", { type: "textarea", max_length: 250 }),
    defineField("theme", {
      type: "option",
      source: "internal",
      datasource: "banner_themes",
      default_value: "light",
    }),
    defineField("show_cta", { type: "boolean", inline_label: true }),
    defineField("cta_label", {
      type: "text",
      max_length: 40,
      // The editor has no "show when" rule: it hides a field when the rule
      // matches. An unchecked boolean counts as empty, so this keeps the CTA
      // fields hidden until `show_cta` is on.
      conditional_settings: [
        {
          modifications: [{ display: "hide" }],
          rule_match: "all",
          rule_conditions: [
            {
              validated_object: { type: "field", field_key: "show_cta", field_attr: "value" },
              validation: "empty",
              value: null,
            },
          ],
        },
      ],
    }),
    defineField("cta_link", {
      type: "multilink",
      conditional_settings: [
        {
          modifications: [{ display: "hide" }],
          rule_match: "all",
          rule_conditions: [
            {
              validated_object: { type: "field", field_key: "show_cta", field_attr: "value" },
              validation: "empty",
              value: null,
            },
          ],
        },
      ],
    }),
    defineField("background_image", { type: "asset", filetypes: ["images"] }),
  ],
});
