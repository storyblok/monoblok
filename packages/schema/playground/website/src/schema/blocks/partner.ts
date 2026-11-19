import { defineBlock, defineField } from "@storyblok/schema";

export const partnerBlock = defineBlock({
  name: "partner",
  display_name: "Partner",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("portfolio", {
      allow_advanced_search: true,
      filter_content_type: ["enterprise_case_study"],
      folder_slug: "cs/",
      source: "internal_stories",
      type: "options",
    }),
    defineField("blog_posts", {
      allow_advanced_search: true,
      filter_content_type: ["blog_entry"],
      folder_slug: "mp/",
      source: "internal_stories",
      type: "options",
    }),
    defineField("webinars", {
      allow_advanced_search: true,
      description: "Events with type other than 'webinar' will be silently ignored",
      filter_content_type: ["event"],
      folder_slug: "ev/",
      source: "internal_stories",
      type: "options",
    }),
    defineField("about", {
      required: true,
      type: "richtext",
    }),
    defineField("certifications", {
      exclude_empty_option: true,
      options: [
        {
          _uid: "ef876a46-eb12-47f7-904d-c77948b489dc",
          name: "Content Migration Expert",
          value: "Content Migration Expert",
        },
        {
          _uid: "3921dda8-d437-474a-b70f-3152fae6f420",
          name: "Content Personalization Expert",
          value: "Content Personalization Expert",
        },
        {
          _uid: "ee63c110-4dc1-473b-ac9b-61da1ec5f034",
          name: "Customer Satisfaction Expert",
          value: "Customer Satisfaction Expert",
        },
        {
          _uid: "1aa84d82-da13-409b-91e2-73fc7a678cd5",
          name: "eCommerce Expert",
          value: "eCommerce Expert",
        },
        {
          _uid: "cb955736-d2cc-4f32-a271-906015568342",
          name: "Enterprise Expert",
          value: "Enterprise Expert",
        },
        {
          _uid: "42f277e7-0c60-43d3-bb62-9b2728381432",
          name: "Integrations Expert",
          value: "Integrations Expert",
        },
        {
          _uid: "cd9414b6-376e-4040-baa5-9946da6e89c4",
          name: "Platinum Expert",
          value: "Platinum Expert",
        },
        {
          _uid: "bdb7071f-4571-41a6-94cc-1a60159fad72",
          name: "Storytelling Expert",
          value: "Storytelling Expert",
        },
      ],
      type: "options",
    }),
    defineField("number_of_enterprise_projects_delivered", {
      type: "text",
    }),
    defineField("tier", {
      datasource: "partners-tiers",
      exclude_empty_option: false,
      required: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("logo", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("logo_background_color", {
      default_value: "default",
      description:
        "You can set custom background color for the partner, by setting this field to `Custom`, which will make the color picker appear.\nThis setting change the looks of the card in the partner page itself, as well as the card in the listing.",
      exclude_empty_option: true,
      options: [
        {
          _uid: "be629512-09c8-40c1-92d0-a26baeb739ae",
          name: "Default",
          value: "default",
        },
        {
          _uid: "2b15a813-a38c-4789-928d-7e097d09938e",
          name: "Custom",
          value: "custom",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("custom_background_color", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "logo_background_color",
                type: "field",
              },
              validation: "not_equals",
              value: "custom",
            },
          ],
          rule_match: "any",
        },
      ],
      field_type: "native-color-picker",
      key: "custom_background_color",
      type: "custom",
    }),
    defineField("company_size", {
      datasource: "partners-company-sizes",
      required: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("partner_id", {
      description: "The name of the partner is used to render an H1 title",
      required: true,
      type: "number",
    }),
    defineField("competencies", {
      datasource: "partners-competencies",
      required: true,
      source: "internal",
      type: "options",
    }),
    defineField("industries", {
      datasource: "partners-industries",
      source: "internal",
      type: "options",
    }),
    defineField("languages", {
      datasource: "partners-languages",
      source: "internal",
      type: "options",
    }),
    defineField("technologies", {
      datasource: "technologies",
      exclude_empty_option: true,
      source: "internal",
      type: "options",
    }),
    defineField("countries", {
      default_value: '["Worldwide"]',
      external_datasource: "https://example.com/countries.json?include_regions",
      required: true,
      source: "external",
      type: "options",
      use_uuid: true,
    }),
    defineField("headquarters", {
      external_datasource: "https://example.com/countries.json?include_regions",
      required: true,
      source: "external",
      type: "option",
      use_uuid: true,
    }),
    defineField("city", {
      required: true,
      type: "text",
    }),
    defineField("website", {
      description: "Must start with https://",
      regex: "^https:\\/\\/[^\\s]+$",
      required: true,
      type: "text",
    }),
    defineField("tab-52a9d6a2-4048-4496-b677-457fc6ff8552", {
      display_name: "Contact",
      keys: [
        "address",
        "country",
        "street",
        "city",
        "contact_mail",
        "contacts",
        "website",
        "countries",
        "headquarters",
      ],
      type: "tab",
    }),
    defineField("tab-9080ecde-3c29-44c2-8e65-bf43d3321c5a", {
      display_name: "Settings",
      keys: [
        "digital_agency",
        "enterprise_ready",
        "high_potential",
        "technology_partner",
        "freelancer",
        "partner_id",
        "category",
        "logo",
        "industry",
        "competencies",
        "industries",
        "size",
        "company_size",
        "languages",
        "logo_background_color",
        "custom_background_color",
        "technologies",
        "tier",
      ],
      type: "tab",
    }),
  ],
});
