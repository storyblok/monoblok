import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const roadmapBlock = defineBlock({
  name: "roadmap",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/roadmap.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("categories", {
      allow: ["roadmap_category"],
      type: "bloks",
    }),
  ],
});
