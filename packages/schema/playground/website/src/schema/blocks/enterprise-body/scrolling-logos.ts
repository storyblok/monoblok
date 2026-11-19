import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const scrollingLogosBlock = defineBlock({
  name: "scrolling_logos",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/scrolling_logos.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("logos", {
      description: "Please add SVG files only!",
      filetypes: ["images"],
      required: true,
      type: "multiasset",
    }),
    defineField("caption", {
      description: "This caption will be displayed on top of the logos.",
      type: "text",
    }),
  ],
});
