import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseFactsBlock = defineBlock({
  name: "enterprise_facts",
  display_name: "Facts",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_facts.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      description: "Only available for screenreaders",
      type: "text",
    }),
    defineField("facts", {
      allow: ["enterprise_fact"],
      maximum: 4,
      type: "bloks",
    }),
  ],
});
