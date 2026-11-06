import { defineBlock, defineField } from "@storyblok/schema";

import { contentConfidenceFolder } from "../../folders";

export const contentConfidenceTickerStatsBlock = defineBlock({
  name: "content_confidence_ticker_stats",
  display_name: "Ticker Stats",
  is_root: false,
  is_nestable: true,
  folder: contentConfidenceFolder,
  fields: [
    defineField("stats", {
      allow: ["content_confidence_ticker_stats_item"],
      display_name: "",
      minimum: 1,
      type: "bloks",
    }),
  ],
});
