import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseCtaGroupBlock = defineBlock({
  name: "enterprise_cta_group",
  display_name: "CTA Group (deprecated)",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock",
  image: "https://example.com/component-screenshots/enterprise_cta_group.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("text", {
      type: "textarea",
    }),
    defineField("items", {
      allow: ["enterprise_cta_group_item"],
      type: "bloks",
    }),
  ],
});
