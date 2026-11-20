import { defineBlock, defineField } from "@storyblok/schema";

import { contentConfidenceFolder } from "../../folders";

export const contentConfidenceTickerStatsItemBlock = defineBlock({
  name: "content_confidence_ticker_stats_item",
  display_name: "Ticker Stat Item",
  is_root: false,
  is_nestable: true,
  folder: contentConfidenceFolder,
  fields: [
    defineField("key", {
      display_name: "",
      required: true,
      type: "text",
    }),
    defineField("value", {
      required: true,
      type: "text",
    }),
  ],
});
