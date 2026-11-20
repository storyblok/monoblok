import { defineBlock, defineField } from "@storyblok/schema";

import { changelogFolder } from "../../folders";

export const changelogLinkBlock = defineBlock({
  name: "changelog_link",
  is_root: false,
  is_nestable: true,
  folder: changelogFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  description: "Link",
  icon: "mouse-pointer",
  fields: [
    defineField("link", {
      required: true,
      type: "multilink",
    }),
    defineField("label", {
      description:
        "Optional name. If left empty the text will be automatically generated based on the link.",
      type: "text",
    }),
  ],
});
