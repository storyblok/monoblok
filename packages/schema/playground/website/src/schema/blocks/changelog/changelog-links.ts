import { defineBlock, defineField } from "@storyblok/schema";

import { changelogFolder } from "../../folders";

export const changelogLinksBlock = defineBlock({
  name: "changelog_links",
  is_root: false,
  is_nestable: true,
  folder: changelogFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  fields: [
    defineField("links", {
      allow: ["changelog_link"],
      type: "bloks",
    }),
  ],
});
