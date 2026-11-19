import { defineBlock, defineField } from "@storyblok/schema";

import { configurationFolder } from "../../folders";

export const navigationMenuBlock = defineBlock({
  name: "navigation_menu",
  is_root: false,
  is_nestable: true,
  folder: configurationFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  fields: [
    defineField("display", {
      required: true,
      type: "text",
    }),
    defineField("link", {
      description:
        "For users with hover-capable input devices, the navigation menu will reveal itself on hover, and this link will be in the top-level navigation.\n\nFor users without hover-capable input devices (e.g. touch screens, special switch inputs), the navigation menu will reveal itself on click, and will not be a link.\n\nMake sure this link is identical to one of the links inside of this menu's navigation categories. If it's not, it will be inserted into the first category.",
      required: true,
      show_anchor: true,
      type: "multilink",
    }),
    defineField("nav_items", {
      allow: ["navigation_category"],
      minimum: 1,
      required: true,
      type: "bloks",
    }),
  ],
});
