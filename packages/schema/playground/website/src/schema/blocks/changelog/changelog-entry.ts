import { defineBlock, defineField } from "@storyblok/schema";

import { changelogFolder } from "../../folders";

export const changelogEntryBlock = defineBlock({
  name: "changelog_entry",
  display_name: "Changelog Entry",
  is_root: true,
  is_nestable: false,
  folder: changelogFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  fields: [
    defineField("title", {
      required: true,
      type: "text",
    }),
    defineField("description", {
      customize_toolbar: true,
      description: "Used in entry cards, meta and OG descriptions.",
      required: true,
      toolbar: [
        "bold",
        "cut",
        "copy",
        "emoji",
        "unset",
        "italic",
        "paste-action",
        "redo",
        "undo",
        "strike",
      ],
      type: "richtext",
    }),
    defineField("image", {
      type: "asset",
    }),
    defineField("pricing_plan", {
      datasource: "pricing-plans",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("categories", {
      datasource: "changelog-categories",
      source: "internal",
      type: "options",
    }),
    defineField("body", {
      allow: ["changelog_richtext", "changelog_links", "codeblock"],
      type: "bloks",
    }),
  ],
});
