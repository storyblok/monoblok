import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const caseStudiesListingBlock = defineBlock({
  name: "case_studies_listing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/case_studies_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [],
});
