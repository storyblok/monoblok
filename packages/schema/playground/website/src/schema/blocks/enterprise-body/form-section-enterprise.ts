import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const formSectionEnterpriseBlock = defineBlock({
  name: "form_section_enterprise",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/form_section_enterprise.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      description: "This field is used to render an H1 title",
      type: "text",
    }),
    defineField("tab-cc77ec7a-4ac9-4a6b-a617-e01a78c7dd9f", {
      display_name: "Options",
      type: "tab",
    }),
    defineField("text", {
      customize_toolbar: true,
      toolbar: ["bold"],
      type: "richtext",
    }),
    defineField("template", {
      datasource: "form-templates",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
  ],
});
