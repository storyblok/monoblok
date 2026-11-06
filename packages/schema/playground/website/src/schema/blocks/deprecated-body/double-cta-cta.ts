import { defineBlock, defineField } from "@storyblok/schema";

import { deprecatedBodyFolder } from "../../folders";

export const doubleCtaCtaBlock = defineBlock({
  name: "double_cta_cta",
  display_name: "CTA (deprecated)",
  is_root: false,
  is_nestable: true,
  folder: deprecatedBodyFolder,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock-open",
  preview_tmpl:
    "<div>{{button[0].text}}</div>\n<div>Url: {{button[0].link.cached_url}}</div>\n<div>{{caption}}</div>",
  fields: [
    defineField("button", {
      allow: ["enterprise_cta"],
      maximum: 1,
      type: "bloks",
    }),
    defineField("caption", {
      type: "textarea",
    }),
  ],
});
