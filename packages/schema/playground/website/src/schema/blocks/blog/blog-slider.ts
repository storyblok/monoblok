import { defineBlock, defineField } from "@storyblok/schema";

import { blogFolder } from "../../folders";

export const blogSliderBlock = defineBlock({
  name: "blog_slider",
  is_root: false,
  is_nestable: true,
  folder: blogFolder,
  image: "https://example.com/component-screenshots/blog_slider.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("category", {
      datasource: "blog-categories",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
  ],
});
