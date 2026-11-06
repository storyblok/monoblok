import { defineBlock, defineField } from "@storyblok/schema";

export const pricingFeatureBlock = defineBlock({
  name: "pricing_feature",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("name", {
      required: true,
      type: "text",
    }),
    defineField("starter_plan_value", {
      type: "text",
    }),
    defineField("growth_plan_value", {
      type: "text",
    }),
    defineField("growth_plus_plan_value", {
      type: "text",
    }),
    defineField("premium_plan_value", {
      type: "text",
    }),
    defineField("elite_plan_value", {
      type: "text",
    }),
    defineField("additional_info", {
      customize_toolbar: true,
      description:
        "use:\n\n* <subscript text with or without link>\n\nto add additional info below the feature name in it's cell\n ",
      toolbar: ["link", "subscript"],
      type: "richtext",
    }),
  ],
});
