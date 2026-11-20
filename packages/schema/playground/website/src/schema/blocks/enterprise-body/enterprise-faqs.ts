import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseFaqsBlock = defineBlock({
  name: "enterprise_faqs",
  display_name: "FAQs",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_faqs.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("text", {
      customize_toolbar: true,
      toolbar: ["bold", "link", "emoji"],
      type: "richtext",
    }),
    defineField("image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("faqs", {
      allow: ["faq_item"],
      type: "bloks",
    }),
  ],
});
