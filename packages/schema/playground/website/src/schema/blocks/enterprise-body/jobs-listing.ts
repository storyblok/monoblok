import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const jobsListingBlock = defineBlock({
  name: "jobs_listing",
  display_name: "Jobs Listing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/jobs_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [],
});
