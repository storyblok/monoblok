import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const navatticDemoBlock = defineBlock({
  name: "navattic_demo",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  description: "Navattic Demo",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/navattic_demo.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("open_button_label", {
      display_name: "Open Button Label",
      max_length: 42,
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("url", {
      display_name: "URL",
      regex: '^https:\\/\\/([^\\s"])*navattic\\.com([^\\s"])+$',
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("cover", {
      filetypes: ["images"],
      required: true,
      translatable: true,
      type: "asset",
    }),
  ],
});
