import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const anchorLinkSectionBlock = defineBlock({
  name: "anchor_link_section",
  display_name: "Anchor Link Section (deprecated)",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock-open",
  image: "https://example.com/component-screenshots/anchor_link_section.png",
  fields: [
    defineField("has_anchor_link", {
      default_value: true,
      type: "boolean",
    }),
    defineField("name", {
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
                field_key: "has_anchor_link",
                type: "field",
              },
              validation: "equals",
              value: true,
            },
          ],
          rule_match: "all",
        },
      ],
      required: false,
      type: "text",
    }),
    defineField("image", {
      required: true,
      type: "asset",
    }),
    defineField("items", {
      allow: ["anchor_link_section_item"],
      maximum: 3,
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("background_color", {
      field_type: "native-color-picker",
      options: [
        {
          _uid: "6054eb88-4c7e-496d-95a0-ed1261bf04af",
          name: "size",
          value: "",
        },
        {
          _uid: "0ac0628c-d841-45c5-b08d-ef514c97865b",
          name: "defaultValue",
          value: "#1b243f0f",
        },
        {
          _uid: "0547fb2c-cbc9-4a6b-a611-d4a0698e68b1",
          name: "colors",
          value: '["#1b243f0f", "#F3F6FF", "#FFF8EE", "#F3FFF6"]',
        },
      ],
      required: true,
      type: "custom",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      description:
        "The CTAs are meant to take the space of one of the items. Please don't add them if you already added the maximum number of items!",
      maximum: 2,
      type: "bloks",
    }),
  ],
});
