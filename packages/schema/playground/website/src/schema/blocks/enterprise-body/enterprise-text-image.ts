import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseTextImageBlock = defineBlock({
  name: "enterprise_text_image",
  display_name: "Text Image",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_text_image.png",
  preview_field: "headline",
  preview_tmpl:
    "<strong>{{headline}}</strong>\n<div>Illustration: {{options.illustration}}</div>\n{{image(options.image.filename)/}}",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("image_position", {
      default_value: "Left",
      description: 'Image is positioned "Right" by default.',
      exclude_empty_option: false,
      options: [
        {
          name: "Right",
          value: "right",
        },
        {
          name: "Left",
          value: "left",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("headline", {
      description: "This field is used to render an H1 title",
      type: "text",
    }),
    defineField("subheadline", {
      type: "text",
    }),
    defineField("text", {
      customize_toolbar: true,
      toolbar: ["bold", "italic", "link", "strike", "subscript", "superscript"],
      type: "richtext",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      maximum: 2,
      type: "bloks",
    }),
    defineField("tab-47a9febf-d345-46c2-b312-b26448172d27", {
      display_name: "Image",
      keys: ["image_position", "image"],
      type: "tab",
    }),
    defineField("tab-bd74bdbb-5591-42d0-ae44-d856ea315776", {
      display_name: "Options",
      keys: ["variation"],
      type: "tab",
    }),
    defineField("variation", {
      options: [
        {
          name: "Long Text",
          value: "long-text",
        },
      ],
      type: "options",
    }),
  ],
});
