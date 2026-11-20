import { defineBlock, defineField } from "@storyblok/schema";

export const technologyPartnerBlock = defineBlock({
  name: "technology_partner",
  display_name: "Technology Partner",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("body", {
      allow: ["enterprise_text", "blocks_group", "text_logos_links"],
      description:
        "To add Use Cases for this technology partner, use the blocks group component and add an intro component for the headline, and a custom boxes grid component with the small boxes for the containers.",
      type: "bloks",
    }),
    defineField("portfolio", {
      allow_advanced_search: true,
      filter_content_type: ["enterprise_case_study"],
      folder_slug: "cs/",
      source: "internal_stories",
      type: "options",
    }),
    defineField("short_description", {
      description:
        "This description will be used when displaying the partner card in the Technology Partners Listing page.",
      required: true,
      type: "textarea",
    }),
    defineField("integration_status", {
      datasource: "technology-partners-integration-statuses",
      description:
        "This field describes the status of an integration between Storyblok and the tech partner.",
      exclude_empty_option: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("logo", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("website", {
      description: "Please include https://",
      regex: "^https:\\/\\/[^\\s]+$",
      type: "text",
    }),
    defineField("category", {
      datasource: "technology-partners-categories",
      display_name: "Category",
      required: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("tab-9080ecde-3c29-44c2-8e65-bf43d3321c5a", {
      display_name: "Settings",
      keys: [
        "digital_agency",
        "enterprise_ready",
        "high_potential",
        "technology_partner",
        "freelancer",
        "category",
        "logo",
        "industry",
        "size",
        "categories",
        "website",
      ],
      type: "tab",
    }),
  ],
});
