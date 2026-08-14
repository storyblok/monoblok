import { defineField } from "@storyblok/schema";

export function seoFields() {
  return [
    defineField("seo_title", { type: "text", max_length: 70 }),
    defineField("seo_description", { type: "textarea", max_length: 160 }),
  ];
}

export function ctaFields() {
  return [
    defineField("cta_label", { type: "text", max_length: 40 }),
    defineField("cta_link", { type: "multilink" }),
  ];
}

export function styleFields() {
  return [
    defineField("background_image", { type: "asset", filetypes: ["images"] }),
    defineField("use_overlay", { type: "boolean", inline_label: true }),
    defineField("overlay_color", {
      type: "text",
      max_length: 7,
      // The editor hides a field when the rule matches, and an unchecked
      // boolean counts as empty: hidden until `use_overlay` is on.
      conditional_settings: [
        {
          modifications: [{ display: "hide" }],
          rule_match: "all",
          rule_conditions: [
            {
              validated_object: {
                type: "field",
                field_key: "use_overlay",
                field_attr: "value",
              },
              validation: "empty",
              value: null,
            },
          ],
        },
      ],
    }),
  ];
}
