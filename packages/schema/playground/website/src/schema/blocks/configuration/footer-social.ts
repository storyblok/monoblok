import { defineBlock, defineField } from "@storyblok/schema";

import { configurationFolder } from "../../folders";

export const footerSocialBlock = defineBlock({
  name: "footer_social",
  is_root: false,
  is_nestable: true,
  folder: configurationFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  preview_field: "display",
  fields: [
    defineField("display", {
      required: true,
      type: "text",
    }),
    defineField("link", {
      asset_link_type: true,
      email_link_type: true,
      required: true,
      show_anchor: true,
      type: "multilink",
    }),
    defineField("icon", {
      datasource: "icons",
      required: true,
      source: "internal",
      type: "option",
    }),
  ],
});
