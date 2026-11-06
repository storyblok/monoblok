import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterprisePricingBlock = defineBlock({
  name: "enterprise_pricing",
  display_name: "Pricing",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_pricing.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("plans", {
      allow: ["enterprise_pricing_box"],
      maximum: 4,
      type: "bloks",
    }),
  ],
});
