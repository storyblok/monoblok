import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const animatedTilesBlock = defineBlock({
  name: "animated_tiles",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/animated_tiles.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("tiles", {
      allow: ["animated_tile"],
      maximum: 2,
      minimum: 2,
      required: true,
      type: "bloks",
    }),
  ],
});
