import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseCaseStudyReferencesBlock = defineBlock({
  name: "enterprise_case_study_references",
  display_name: "Case Study References",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/enterprise_case_study_references.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      description: "",
      type: "text",
    }),
    defineField("case_studies", {
      filter_content_type: ["enterprise_case_study"],
      folder_slug: "cs/",
      source: "internal_stories",
      type: "options",
    }),
  ],
});
