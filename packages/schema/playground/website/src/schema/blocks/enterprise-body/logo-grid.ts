import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const logoGridBlock = defineBlock({
  name: "logo_grid",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/logo_grid.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("items", {
      allow: ["logo_grid_item"],
      description:
        "If the grid contains four or a multiple of four items, it will be a four-column grid with however many rows are needed.\nFor any other number of items, the grid will fit the items on one row.",
      minimum: 4,
      required: true,
      type: "bloks",
    }),
  ],
});
