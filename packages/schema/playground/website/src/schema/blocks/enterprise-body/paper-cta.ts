import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const paperCtaBlock = defineBlock({
  name: "paper_cta",
  display_name: "Paper CTA",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/paper_cta.png",
  preview_field: "headline",
  preview_tmpl: "<div>{{headline}}</div>\n{{image(options.image.filename)/}}",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("text", {
      customize_toolbar: true,
      toolbar: [
        "bold",
        "list",
        "inlinecode",
        "h3",
        "h4",
        "h5",
        "italic",
        "link",
        "olist",
        "strike",
        "subscript",
        "superscript",
      ],
      type: "richtext",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      maximum: 2,
      type: "bloks",
    }),
    defineField("image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("image_position", {
      default_value: "left",
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
    defineField("tab-47a9febf-d345-46c2-b312-b26448172d27", {
      display_name: "Image",
      keys: ["image", "image_position"],
      type: "tab",
    }),
  ],
});
