import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const technologyPartnersListingBlock = defineBlock({
  name: "technology_partners_listing",
  display_name: "Technology Partners Listing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/technology_partners_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [],
});
