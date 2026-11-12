import { defineBlock, defineField } from "@storyblok/schema";

import { changelogFolder } from "../../folders";

export const changelogsBlock = defineBlock({
  name: "changelogs",
  display_name: "Changelog Listing",
  is_root: true,
  is_nestable: false,
  folder: changelogFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  fields: [
    defineField("title", {
      type: "text",
    }),
    defineField("subtitle", {
      type: "text",
    }),
    defineField("entry_placeholder_image", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("og_description", {
      display_name: "Description",
      translatable: true,
      type: "textarea",
    }),
    defineField("og_image", {
      display_name: "OG Image",
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
  ],
});
