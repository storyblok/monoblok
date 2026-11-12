import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const tutorialsListingBlock = defineBlock({
  name: "tutorials_listing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/tutorials_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [],
});
