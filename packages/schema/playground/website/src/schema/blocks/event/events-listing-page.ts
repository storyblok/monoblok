import { defineBlock, defineField } from "@storyblok/schema";

import { eventFolder } from "../../folders";

export const eventsListingPageBlock = defineBlock({
  name: "events_listing_page",
  display_name: "Events Listing Page",
  is_root: true,
  is_nestable: false,
  folder: eventFolder,
  color: "var(--sb-color-accent-background-lavender)",
  icon: "map-pin",
  fields: [
    defineField("og_description", {
      display_name: "Description",
      translatable: true,
      type: "textarea",
    }),
    defineField("og_image", {
      display_name: "OG Image",
      filetypes: ["images"],
      required: false,
      translatable: true,
      type: "asset",
    }),
    defineField("noindex", {
      description: "Hide this entry from search engines and from the internal search",
      type: "boolean",
    }),
    defineField("heading", {
      allow: ["richtext_heading_with_description_and_ctas"],
      maximum: 1,
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("banner", {
      allow: ["cta_image"],
      maximum: 1,
      type: "bloks",
    }),
    defineField("events_listing", {
      allow: ["events_listing"],
      maximum: 1,
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Enterprise Body",
        },
        {
          tag: "Whitelist: Root Body",
        },
      ],
      required: false,
      type: "bloks",
    }),
    defineField("tab-4d576d9a-310a-4ef3-a771-278ba6b32349", {
      display_name: "Content",
      keys: ["heading", "banner", "events_listing", "body"],
      type: "tab",
    }),
  ],
});
