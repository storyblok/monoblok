import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const doubleCtaBlock = defineBlock({
  name: "double_cta",
  display_name: "Double Cta (deprecated)",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock-open",
  image: "//a.storyblok.com/f/88751/x/4b1da8552a/screenshot-2021-01-29-at-07-01-27.png",
  preview_tmpl: "<strong>{{headline}}</strong>",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("text", {
      customize_toolbar: true,
      toolbar: ["bold"],
      type: "richtext",
    }),
    defineField("ctas", {
      allow: ["double_cta_cta"],
      display_name: "CTAs",
      maximum: 2,
      type: "bloks",
    }),
    defineField("custom_logo", {
      filetypes: ["images"],
      type: "asset",
    }),
  ],
});
