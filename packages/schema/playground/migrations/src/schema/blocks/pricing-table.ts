import { defineBlock, defineField } from "@storyblok/schema";

import { headlineField } from "../fields";

export const pricingTableBlock = defineBlock({
  name: "pricing_table",
  is_nestable: true,
  fields: [
    headlineField,
    defineField("currency", {
      type: "option",
      source: "internal",
      datasource: "currencies",
      default_value: "eur",
    }),
    defineField("table", { type: "table" }),
    defineField("footnote", { type: "text", max_length: 300, translatable: true }),
  ],
});
