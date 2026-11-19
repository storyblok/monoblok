import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const whitepapersListingBlock = defineBlock({
  name: "whitepapers_listing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/whitepapers_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("featured_entry", {
      filter_content_type: ["whitepaper"],
      folder_slug: "lp/",
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
  ],
});
