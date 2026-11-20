import { defineBlock, defineField } from "@storyblok/schema";

import { configurationFolder } from "../../folders";

export const navigationGroupBlock = defineBlock({
  name: "navigation_group",
  display_name: "Footer Navigation Group",
  is_root: false,
  is_nestable: true,
  folder: configurationFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  preview_tmpl:
    "<div>\n{{it.group_name}}\n</div>\n{{@if(it.navitems.length &gt; 0)}}\n<div>\n{{@if(it.navitems.length == 1)}}\n{{it.navitems.length}} item\n{{#else}}\n{{it.navitems.length}} items\n{{/if}}\n</div>\n{{/if}}",
  fields: [
    defineField("group_name", {
      required: true,
      type: "text",
    }),
    defineField("navitems", {
      allow: ["footer_navigation_item"],
      display_name: "Nav Items",
      type: "bloks",
    }),
  ],
});
