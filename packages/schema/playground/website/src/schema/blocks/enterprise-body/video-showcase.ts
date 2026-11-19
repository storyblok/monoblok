import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const videoShowcaseBlock = defineBlock({
  name: "video_showcase",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/video_showcase.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("slides", {
      allow: ["video_showcase_slide"],
      type: "bloks",
    }),
  ],
});
