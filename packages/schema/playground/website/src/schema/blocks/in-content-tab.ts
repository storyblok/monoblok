import { defineBlock, defineField } from "@storyblok/schema";

export const inContentTabBlock = defineBlock({
  name: "in_content_tab",
  is_root: false,
  is_nestable: true,
  image: "https://example.com/component-screenshots/in_content_tab.png",
  fields: [
    defineField("name", {
      type: "text",
    }),
    defineField("body", {
      allow: ["custom_richtext", "codeblock"],
      type: "bloks",
    }),
    defineField("icon", {
      type: "asset",
    }),
  ],
});
