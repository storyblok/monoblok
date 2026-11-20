import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const anchorLinkSectionsBlock = defineBlock({
  name: "anchor_link_sections",
  display_name: "Anchor Link Sections (deprecated)",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock-open",
  image: "https://example.com/component-screenshots/anchor_link_sections.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("sections", {
      allow: ["anchor_link_section"],
      minimum: 2,
      required: true,
      type: "bloks",
    }),
  ],
});
