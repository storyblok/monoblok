import { defineBlock, defineField } from "@storyblok/schema";

import { mvpFolder } from "../../folders";

export const mvpsListingBlock = defineBlock({
  name: "mvps_listing",
  display_name: "MVPs Listing",
  is_root: false,
  is_nestable: true,
  folder: mvpFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  tags: ["Whitelist: Enterprise Body"],
  fields: [],
});
