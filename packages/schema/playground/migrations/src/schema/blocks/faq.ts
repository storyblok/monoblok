import { defineBlock, defineField } from "@storyblok/schema";

import { headlineField, richtextField } from "../fields";

export const faqItemBlock = defineBlock({
  name: "faq_item",
  is_nestable: true,
  fields: [
    defineField("question", { type: "text", max_length: 200, translatable: true, required: true }),
    defineField("answer", { ...richtextField, translatable: true }),
  ],
});

export const faqBlock = defineBlock({
  name: "faq",
  is_nestable: true,
  fields: [
    headlineField,
    defineField("categories", {
      type: "options",
      source: "internal",
      datasource: "faq_categories",
    }),
    defineField("items", { type: "bloks", allow: [faqItemBlock.name], minimum: 1 }),
  ],
});
