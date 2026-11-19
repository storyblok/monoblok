import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const textFormBlock = defineBlock({
  name: "text_form",
  display_name: "Text and Form",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/text_form.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("form_template", {
      datasource: "form-templates",
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("pardot_form", {
      regex:
        "^https:\\/\\/go\\.storyblok\\.com\\/l\\/1001391\\/\\d{4}-\\d{2}-\\d{2}\\/[a-zA-Z0-9]+$",
      type: "text",
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
      description: "This field is used to render an H1 title",
      translatable: true,
      type: "text",
    }),
    defineField("intro_text", {
      description: "Displayed at the top, bold font",
      translatable: true,
      type: "textarea",
    }),
    defineField("main_text", {
      allow: [
        "image_with_decorations",
        "richtext_heading_with_description_and_ctas",
        "video",
        "image",
        "mvp_category_summaries",
      ],
      customize_toolbar: true,
      description: "Right below the intro",
      style_options: [
        {
          _uid: "6c59ee01-bddb-4e70-95fa-f98c54a52f71",
          name: "Purple Color",
          value: "heading-emphasis-solid-purple",
        },
        {
          _uid: "82734e92-09f6-43c7-ace6-0a5c60162323",
          name: "Blue Color",
          value: "heading-emphasis-solid-blue",
        },
        {
          _uid: "ef88626f-58f8-45fd-916a-2cfda5d8b8ca",
          name: "Green Color",
          value: "heading-emphasis-solid-green",
        },
        {
          _uid: "80303717-7a29-48d6-8499-33a1583a60e2",
          name: "Yellow Color",
          value: "heading-emphasis-solid-yellow",
        },
        {
          _uid: "46235942-e2e2-4871-8862-a0228ae61002",
          name: "Orange Color",
          value: "heading-emphasis-solid-orange",
        },
        {
          _uid: "7b0de234-e796-411d-95dc-64a29ca6dc8f",
          name: "Red Color",
          value: "heading-emphasis-solid-red",
        },
      ],
      toolbar: [
        "blok",
        "bold",
        "list",
        "h1",
        "h2",
        "h3",
        "h4",
        "hrule",
        "image",
        "italic",
        "link",
        "olist",
        "paragraph",
        "strike",
        "subscript",
        "superscript",
        "underline",
        "unset",
      ],
      translatable: true,
      type: "richtext",
    }),
    defineField("footer_text", {
      customize_toolbar: true,
      description: "Displayed below the rest, smaller font",
      toolbar: ["bold", "italic", "link", "superscript", "strike", "subscript", "unset"],
      translatable: true,
      type: "richtext",
    }),
    defineField("quotes", {
      filter_content_type: ["new_quote"],
      source: "internal_stories",
      type: "options",
    }),
    defineField("tab-c9b64ecc-bfd2-436f-bdd3-553820dd7d7d", {
      display_name: "Form",
      keys: [
        "form_template",
        "phone_field",
        "phone_require",
        "phone_required",
        "hide_phone_field",
        "phone_field",
        "pardot_form",
      ],
      type: "tab",
    }),
  ],
});
