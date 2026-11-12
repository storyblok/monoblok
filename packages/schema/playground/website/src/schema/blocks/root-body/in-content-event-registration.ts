import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const inContentEventRegistrationBlock = defineBlock({
  name: "in_content_event_registration",
  display_name: "Event Registration",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/in_content_event_registration.png",
  tags: ["Whitelist: Root Body"],
  fields: [
    defineField("campaign_id", {
      default_value: "",
      description: "Campaign ID from Salesforce.",
      type: "text",
    }),
    defineField("lead_source", {
      default_value: "Event",
      description: "",
      options: [
        {
          name: "Event",
          value: "Event",
        },
        {
          name: "Storyblok Event",
          value: "Storyblok Event",
        },
        {
          name: "Webinar",
          value: "Webinar",
        },
        {
          name: "Other",
          value: "Other",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("pardot_form", {
      regex:
        "^https:\\/\\/go\\.storyblok\\.com\\/l\\/1001391\\/\\d{4}-\\d{2}-\\d{2}\\/[a-zA-Z0-9]+$",
      type: "text",
    }),
    defineField("form_template", {
      datasource: "gated-content-form-templates",
      default_value: "default",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("phone_field", {
      default_value: " ",
      options: [
        {
          name: "Optional",
          value: " ",
        },
        {
          name: "Hidden",
          value: "hidden",
        },
        {
          name: "Required",
          value: "required",
        },
      ],
      type: "option",
      use_uuid: true,
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
    defineField("event_label", {
      description:
        'Fill out this field to setup the tracking of the "view" and "submit" events for this form in Analytics',
      translatable: true,
      type: "text",
    }),
    defineField("success_message", {
      customize_toolbar: true,
      toolbar: ["bold", "italic"],
      translatable: true,
      type: "richtext",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Enterprise Body",
        },
      ],
      type: "bloks",
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
        "success_message",
        "form_template",
        "hide_phone_field",
        "phone_required",
        "phone_field",
        "lead_source",
        "pardot_form",
        "campaign_id",
        "bullet_list",
      ],
      type: "tab",
    }),
    defineField("tab-e6f3b277-ee0b-4e9f-a777-0ce8b9e908e6", {
      display_name: "Gated Content",
      keys: [
        "body_direct",
        "headline_direct",
        "text_direct",
        "title_direct",
        "swap_title_and_text",
      ],
      type: "tab",
    }),
    defineField("body_direct", {
      default_value: "",
      description:
        'This content will be shown if gated content is submitted and "direct" is choosen as the type of the gated content piece.',
      type: "bloks",
    }),
  ],
});
