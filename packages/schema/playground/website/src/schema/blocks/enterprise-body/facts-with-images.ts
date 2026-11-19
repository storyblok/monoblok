import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const factsWithImagesBlock = defineBlock({
  name: "facts_with_images",
  display_name: "Facts with Images",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/facts_with_images.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("facts", {
      allow: ["fact_with_image"],
      maximum: 4,
      type: "bloks",
    }),
  ],
});
