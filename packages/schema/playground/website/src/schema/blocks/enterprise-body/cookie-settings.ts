import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const cookieSettingsBlock = defineBlock({
  name: "cookie_settings",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/cookie_settings.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("groups", {
      allow: ["cookie_group"],
      type: "bloks",
    }),
  ],
});
