import { defineBlock, defineField } from "@storyblok/schema";

import { appsFolder } from "../../folders";

export const appsBlock = defineBlock({
  name: "apps",
  display_name: "Apps",
  is_root: true,
  is_nestable: false,
  folder: appsFolder,
  fields: [
    defineField("banner", {
      allow: ["app_store_banner"],
      maximum: 1,
      type: "bloks",
    }),
    defineField("tab-8e97f972-b459-4832-a99e-0c7dd9b67279", {
      display_name: "Content",
      keys: ["banner"],
      type: "tab",
    }),
    defineField("og_description", {
      display_name: "Description",
      translatable: true,
      type: "textarea",
    }),
    defineField("og_image", {
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
  ],
});
