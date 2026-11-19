import { defineBlock, defineField } from "@storyblok/schema";

export const pricingPlanBlock = defineBlock({
  name: "pricing_plan",
  display_name: "Pricing Plan",
  is_root: false,
  is_nestable: true,
  fields: [
    defineField("name", {
      required: true,
      type: "text",
    }),
    defineField("accent_color", {
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
      required: true,
      source: "internal",
      type: "custom",
    }),
    defineField("cta_link", {
      display_name: "CTA Link",
      required: true,
      type: "multilink",
    }),
    defineField("cta_text", {
      display_name: "CTA Text",
      required: true,
      type: "text",
    }),
    defineField("monthly_costs", {
      display_name: "Monthly Costs (starts at)",
      required: true,
      type: "text",
    }),
    defineField("tab-348a5910-abf7-456a-95d1-651a046d986a", {
      display_name: "config",
      keys: ["plan_id"],
      type: "tab",
    }),
    defineField("plan_id", {
      exclude_empty_option: true,
      options: [
        {
          _uid: "f150d640-d660-48c9-a8f5-7941c181c7b1",
          name: "starter",
          value: "starter",
        },
        {
          _uid: "e75e10d1-3add-4a20-bccf-56df8f3e5fe5",
          name: "growth",
          value: "growth",
        },
        {
          _uid: "b6b175e3-4bdf-49af-a082-0db24a339aa1",
          name: "growth_plus",
          value: "growth_plus",
        },
        {
          _uid: "13914ff9-853d-425f-b261-811feb41f010",
          name: "premium",
          value: "premium",
        },
        {
          _uid: "83671c29-fbd6-43ad-83be-7f86c19ab605",
          name: "elite",
          value: "elite",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
  ],
});
