import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const metricBlock = defineBlock({
  name: "metric",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/metric.png",
  fields: [
    defineField("label", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("prefix", {
      description: 'Shown before the amount, e.g. "£" or "over".',
      translatable: true,
      type: "text",
    }),
    defineField("amount", {
      required: true,
      type: "number",
    }),
    defineField("suffix", {
      description: 'Shown after the amount, e.g. "%" or "x faster".',
      translatable: true,
      type: "text",
    }),
  ],
});
