import { defineBlock, defineField } from "@storyblok/schema";

import { eventFolder } from "../../folders";

export const eventBlock = defineBlock({
  name: "event",
  display_name: "Event",
  is_root: true,
  is_nestable: false,
  folder: eventFolder,
  color: "var(--sb-color-accent-background-lavender)",
  icon: "map-pin",
  fields: [
    defineField("title", {
      conditional_settings: [
        {
          modifications: [
            {
              required: true,
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "enable_external_link",
                type: "field",
              },
              validation: "not_equals",
              value: true,
            },
          ],
          rule_match: "any",
        },
      ],
      description: "This field is used to render an H1 title",
      translatable: true,
      type: "text",
    }),
    defineField("excerpt", {
      max_length: "150",
      translatable: true,
      type: "textarea",
    }),
    defineField("preview_image", {
      description: "Displayed on the events page. Should not contain any significant text.",
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
    defineField("og_description", {
      display_name: "Description",
      translatable: true,
      type: "textarea",
    }),
    defineField("og_image", {
      description:
        "Displayed in social media link previews. Can contain significant text such as the event name.",
      display_name: "OG Image",
      filetypes: ["images"],
      translatable: true,
      type: "asset",
    }),
    defineField("noindex", {
      description: "Hide this entry from search engines and from the internal search",
      type: "boolean",
    }),
    defineField("storyblok_event", {
      type: "boolean",
    }),
    defineField("start_date", {
      required: false,
      type: "datetime",
    }),
    defineField("end_date", {
      description: 'Used to determine whether event is "upcoming" or "past".',
      required: false,
      type: "datetime",
    }),
    defineField("unlisted", {
      description: "The event won't be included in the listing",
      type: "boolean",
    }),
    defineField("hide_time", {
      description:
        "Select this to hide the time in both the listing and detail page. Only the date will be shown",
      type: "boolean",
    }),
    defineField("event_type", {
      description: "",
      options: [
        {
          _uid: "e2495298-0f25-4541-bb67-61e46a95fdc3",
          name: "Storyblok Event (deprecated)",
          value: "storyblok_event",
        },
        {
          _uid: "c8d69af6-ee46-4729-b2a5-0fc70b9ca7f0",
          name: "Webinar",
          value: "webinar",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("text", {
      customize_toolbar: true,
      description: "Text below the main title",
      toolbar: ["bold", "link", "image"],
      translatable: true,
      type: "richtext",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Enterprise Body",
        },
        {
          tag: "Whitelist: Root Body",
        },
      ],
      type: "bloks",
    }),
    defineField("tab-64feb046-a030-4c15-8a32-53f34077f6cd", {
      display_name: "Content",
      keys: ["text", "body"],
      type: "tab",
    }),
    defineField("tab-2586dfb6-775e-4464-a65d-80699fb28004", {
      display_name: "Settings",
      keys: [
        "authors",
        "type",
        "tech",
        "beginner",
        "is_gated_content",
        "category",
        "start_date",
        "end_date",
        "category",
        "storyblok_event",
        "start_time",
        "end_time",
        "hide_time",
        "success_message",
        "form_template",
        "unlisted",
        "event_type",
      ],
      type: "tab",
    }),
    defineField("tab-251172ee-a227-49fa-a8be-de29741443c3", {
      display_name: "External Page",
      keys: ["external_link", "enable_external_link"],
      type: "tab",
    }),
    defineField("tab-f2a1687e-58c5-499c-bc9d-31ba6b34bdeb", {
      display_name: "Style",
      keys: ["width"],
      type: "tab",
    }),
    defineField("enable_external_link", {
      description: 'Open an external page defined in the "External link" field',
      type: "boolean",
    }),
    defineField("external_link", {
      type: "multilink",
    }),
    defineField("width", {
      default_value: "default",
      options: [
        {
          _uid: "aa31e288-f9af-418c-8214-97a79133ce1d",
          name: "Default",
          value: "default",
        },
        {
          _uid: "40a4db55-ad43-41cb-b57c-67d4df44fbb5",
          name: "Wide",
          value: "wide",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
  ],
});
