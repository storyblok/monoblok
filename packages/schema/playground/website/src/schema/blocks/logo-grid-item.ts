import { defineBlock, defineField } from "@storyblok/schema";

export const logoGridItemBlock = defineBlock({
  name: "logo_grid_item",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/logo_grid_item.png",
  fields: [
    defineField("logo", {
      description:
        'Please remember to add the company name, followed by the word "logo", as alt text to each logo. You can do this by clicking the edit button on the asset, and then filling out the "Alt Text" field.',
      required: true,
      type: "asset",
    }),
    defineField("link", {
      show_anchor: true,
      type: "multilink",
    }),
    defineField("name", {
      type: "text",
    }),
  ],
});
