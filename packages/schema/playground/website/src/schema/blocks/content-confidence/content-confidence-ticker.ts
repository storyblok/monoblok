import { defineBlock, defineField } from "@storyblok/schema";

import { contentConfidenceFolder } from "../../folders";

export const contentConfidenceTickerBlock = defineBlock({
  name: "content_confidence_ticker",
  is_root: false,
  is_nestable: true,
  folder: contentConfidenceFolder,
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("title", {
      description: "Words wrapped in [color]word[/color] will be highlighted.",
      required: true,
      type: "text",
    }),
    defineField("start_date", {
      disable_time: true,
      required: true,
      type: "datetime",
    }),
    defineField("amount_per_second", {
      decimals: 0,
      max_value: 1000000,
      min_value: 0,
      required: true,
      type: "number",
    }),
    defineField("body", {
      allow: ["custom_richtext", "enterprise_cta", "content_confidence_ticker_stats"],
      type: "bloks",
    }),
  ],
});
