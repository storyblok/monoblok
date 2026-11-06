import { defineBlock, defineField } from "@storyblok/schema";

import { mvpFolder } from "../../folders";

export const mvpHighlightsBlock = defineBlock({
  name: "mvp_highlights",
  display_name: "MVP Highlights",
  is_root: false,
  is_nestable: true,
  folder: mvpFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("mvps", {
      allow_advanced_search: true,
      entry_appearance: "card",
      filter_content_type: ["mvp"],
      is_reference_type: true,
      max_options: 3,
      min_options: 2,
      source: "internal_stories",
      type: "options",
    }),
  ],
});
