import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const faqsListingBlock = defineBlock({
  name: "faqs_listing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/faqs_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [],
});
