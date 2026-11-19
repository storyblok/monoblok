import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const tilesGridBlock = defineBlock({
  name: "tiles_grid",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/tiles_grid.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("tiles", {
      allow: ["tile"],
      description: "Please use 50% width tiles always in pairs",
      required: true,
      type: "bloks",
    }),
  ],
});
