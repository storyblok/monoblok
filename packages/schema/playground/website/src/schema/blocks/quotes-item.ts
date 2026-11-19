import { defineBlock, defineField } from "@storyblok/schema";

export const quotesItemBlock = defineBlock({
  name: "quotes_item",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/quotes_item.png",
  fields: [
    defineField("headline", {
      required: false,
      type: "text",
    }),
    defineField("headline_decoration", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "headline",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
      description: "A small image displayed inline after the headline.",
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("quote", {
      allow_advanced_search: true,
      entry_appearance: "card",
      filter_content_type: ["new_quote"],
      max_options: "1",
      min_options: "1",
      required: true,
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
  ],
});
