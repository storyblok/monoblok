import { defineBlock, defineField } from "@storyblok/schema";

export const enterprisePageBlock = defineBlock({
  name: "enterprise_page",
  is_root: false,
  is_nestable: true,
  fields: [
    defineField("body", {
      type: "bloks",
    }),
  ],
});
