import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const customersLogosBlock = defineBlock({
  name: "customers_logos",
  display_name: "Logos",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/customers_logos.png",
  preview_tmpl: "{{foreach(options.logos)}}\n{{image(@this.filename)/}} \n{{/foreach}}",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("logos_list", {
      allow: ["logo"],
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("cta", {
      allow: ["enterprise_cta"],
      description: "CTA button below logos",
      display_name: "CTA",
      maximum: 2,
      type: "bloks",
    }),
  ],
});
