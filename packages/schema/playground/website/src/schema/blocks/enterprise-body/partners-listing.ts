import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const partnersListingBlock = defineBlock({
  name: "partners_listing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/partners_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      description: "This field is used to render an H1 title",
      type: "textarea",
    }),
    defineField("text", {
      customize_toolbar: true,
      toolbar: ["bold"],
      type: "richtext",
    }),
  ],
});
