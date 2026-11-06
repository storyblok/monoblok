import { defineBlock, defineField } from "@storyblok/schema";

export const demoFormQuoteBlock = defineBlock({
  name: "demo_form_quote",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  tags: ["Whitelist: Demo Form Side Content"],
  fields: [
    defineField("quote", {
      allow_advanced_search: true,
      entry_appearance: "card",
      filter_content_type: ["new_quote"],
      max_options: 1,
      min_options: 1,
      required: true,
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
  ],
});
