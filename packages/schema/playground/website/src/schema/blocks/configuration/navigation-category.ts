import { defineBlock, defineField } from "@storyblok/schema";

import { configurationFolder } from "../../folders";

export const navigationCategoryBlock = defineBlock({
  name: "navigation_category",
  is_root: false,
  is_nestable: true,
  folder: configurationFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  preview_tmpl:
    "{{@if(it.navigation_items.length &gt; 0)}}\n<div>\n{{@if(it.navigation_items.length == 1)}}\n{{it.navigation_items.length}} item\n{{#else}}\n{{it.navigation_items.length}} items\n{{/if}}\n</div>\n{{/if}}",
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("navigation_items", {
      allow: ["navigation_category_item"],
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("group_link", {
      description: "Adds a link at the bottom of the group",
      type: "multilink",
    }),
    defineField("group_link_text", {
      description: 'Default is "View All"',
      type: "text",
    }),
  ],
});
