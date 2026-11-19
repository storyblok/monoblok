import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const socialProofBadgesBlock = defineBlock({
  name: "social_proof_badges",
  display_name: "Social Proof Badges",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/social_proof_badges.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("logos", {
      type: "multiasset",
    }),
  ],
});
