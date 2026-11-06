import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const timelineBlock = defineBlock({
  name: "timeline",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/timeline.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("image", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("steps", {
      allow: ["timeline_step"],
      minimum: 2,
      required: true,
      type: "bloks",
    }),
  ],
});
