import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const pressListingBlock = defineBlock({
  name: "press_listing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/press_listing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("featured_entry", {
      filter_content_type: ["press_entry"],
      folder_slug: "",
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
  ],
});
