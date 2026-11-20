import { defineBlock, defineField } from "@storyblok/schema";

export const gatedContentBlock = defineBlock({
  name: "gated_content",
  display_name: "Gated Content",
  is_root: true,
  is_nestable: true,
  fields: [
    defineField("title", {
      description: "This field is used to render an H1 title",
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("og_description", {
      display_name: "Description",
      translatable: true,
      type: "textarea",
    }),
    defineField("og_image", {
      display_name: "OG Image",
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
    defineField("noindex", {
      description: "Hide this entry from search engines and from the internal search",
      type: "boolean",
    }),
    defineField("text", {
      customize_toolbar: true,
      description: "Subtitle shown below title.",
      toolbar: [
        "bold",
        "list",
        "inlinecode",
        "emoji",
        "unset",
        "italic",
        "link",
        "subscript",
        "superscript",
        "strike",
        "olist",
      ],
      translatable: true,
      type: "richtext",
    }),
    defineField("body_before_form", {
      allow: [
        {
          tag: "Whitelist: Enterprise Body",
        },
      ],
      type: "bloks",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Enterprise Body",
        },
      ],
      type: "bloks",
    }),
    defineField("tab-3d57354d-1d91-45d5-9900-be7d146de057", {
      display_name: "Content",
      keys: ["body", "body_before_form", "text"],
      type: "tab",
    }),
    defineField("campaign_id", {
      default_value: "",
      description: "Campaign ID from Salesforce.",
      type: "text",
    }),
    defineField("tab-c3bc7d43-23c1-400b-80c8-539d4682a72b", {
      display_name: "Teaser",
      keys: ["artwork", "description", "teaser_text", "artwork_alt"],
      type: "tab",
    }),
    defineField("tab-4db3dc6e-f0b2-44af-88c8-ac4c815b67b4", {
      display_name: "Form",
      keys: [
        "headline",
        "teaser",
        "type",
        "redirect_to",
        "download",
        "analytics_label",
        "event_label",
        "hide_phone_field",
        "phone_required",
        "custom_thank_you_message",
        "use_custom_thank_you_message",
        "campaign_id",
        "pardot_form",
        "bullet_list",
      ],
      type: "tab",
    }),
    defineField("pardot_form", {
      regex:
        "^https:\\/\\/go\\.storyblok\\.com\\/l\\/1001391\\/\\d{4}-\\d{2}-\\d{2}\\/[a-zA-Z0-9]+$",
      type: "text",
    }),
    defineField("tab-3acb5e5f-6568-45b1-b6c0-46b12f39820c", {
      display_name: "Settings",
      keys: ["header_type", "event_date", "category"],
      type: "tab",
    }),
    defineField("tab-7285f9f1-ec11-4f7e-8e83-99bc4a571b20", {
      display_name: "Preview",
      keys: ["preview_image", "preview_text"],
      type: "tab",
    }),
    defineField("headline", {
      default_value: "",
      description:
        'Optional: Override the default "Read <Title>" headline in the form with custom content.',
      translatable: true,
      type: "text",
    }),
    defineField("bullet_list", {
      customize_toolbar: true,
      restrict_components: false,
      restrict_type: "",
      toolbar: ["list"],
      type: "richtext",
    }),
    defineField("type", {
      exclude_empty_option: true,
      options: [
        {
          _uid: "768731a1-59b4-4bae-b6be-a9337488927f",
          name: "Download",
          value: "download",
        },
        {
          _uid: "67f6ceae-0048-45bd-b802-1dfb15792b14",
          name: "Redirect",
          value: "redirect",
        },
      ],
      required: true,
      translatable: false,
      type: "option",
      use_uuid: true,
    }),
    defineField("download", {
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
                field_key: "type",
                type: "field",
              },
              validation: "not_equals",
              value: "download",
            },
          ],
          rule_match: "any",
        },
      ],
      description: 'File that will be downloaded. Make sure to select "download" as type.',
      translatable: true,
      type: "asset",
    }),
    defineField("redirect_to", {
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
                field_key: "type",
                type: "field",
              },
              validation: "not_equals",
              value: "redirect",
            },
          ],
          rule_match: "any",
        },
      ],
      description: "Target for the redirect after entering the details.",
      type: "multilink",
    }),
    defineField("event_label", {
      description:
        'Fill out this field to setup the tracking of the "view" and "submit" events for this form in Analytics',
      type: "text",
    }),
    defineField("use_custom_thank_you_message", {
      translatable: true,
      type: "boolean",
    }),
    defineField("custom_thank_you_message", {
      customize_toolbar: true,
      toolbar: ["bold", "italic"],
      translatable: true,
      type: "richtext",
    }),
    defineField("artwork", {
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
    defineField("teaser_text", {
      customize_toolbar: true,
      description: "Optional text above the artwork",
      display_name: "Teaser Text",
      toolbar: [
        "bold",
        "list",
        "inlinecode",
        "h2",
        "h3",
        "h4",
        "italic",
        "link",
        "olist",
        "strike",
        "subscript",
        "superscript",
      ],
      translatable: true,
      type: "richtext",
    }),
    defineField("header_type", {
      datasource: "header-types",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("category", {
      datasource: "whitepapers-categories",
      default_value: "Marketing",
      source: "internal",
      type: "options",
      use_uuid: true,
    }),
    defineField("preview_text", {
      translatable: false,
      type: "textarea",
    }),
    defineField("preview_image", {
      filetypes: ["images"],
      type: "asset",
    }),
  ],
});
