import { defineBlock, defineField } from "@storyblok/schema";

export const textQuotesIllustrationLinkBlock = defineBlock({
  name: "text_quotes_illustration_link",
  display_name: "CTA (deprecated)",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock",
  image: "https://example.com/component-screenshots/text_quotes_illustration_link.png",
  fields: [
    defineField("text", {
      type: "text",
    }),
    defineField("link", {
      allow_target_blank: true,
      type: "multilink",
    }),
  ],
});
