import { defineBlock, defineField } from "@storyblok/schema";

import { eventFolder } from "../../folders";

export const eventsListingBlock = defineBlock({
  name: "events_listing",
  is_root: false,
  is_nestable: true,
  folder: eventFolder,
  color: "var(--sb-color-accent-background-lavender)",
  icon: "map-pin",
  image: "https://example.com/component-screenshots/events_listing.png",
  fields: [
    defineField("category", {
      description:
        "Do not change that, please, it controls which kind of events will be displayed for the page",
      exclude_empty_option: true,
      options: [
        {
          _uid: "7a84024c-43e0-4742-86fb-f365b4f86951",
          name: "Upcoming Events",
          value: "events",
        },
        {
          _uid: "b3121dd8-373d-4a02-ac8d-711c3dde154d",
          name: "Upcoming Webinars",
          value: "webinar",
        },
        {
          _uid: "94909d0e-bae4-4a24-9bac-25f734d6da6e",
          name: "Past Events",
          value: "past",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("featured_entry", {
      description: 'Leave empty to populate with "closest to now" event.',
      filter_content_type: ["event"],
      folder_slug: "",
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
    defineField("tab-3f080a82-d40d-484a-b2c4-37318b5b2334", {
      display_name: "Settings",
      keys: ["category"],
      type: "tab",
    }),
  ],
});
