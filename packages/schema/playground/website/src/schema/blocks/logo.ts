import { defineBlock, defineField } from "@storyblok/schema";

export const logoBlock = defineBlock({
  name: "logo",
  is_root: false,
  is_nestable: true,
  fields: [
    defineField("logo", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("link", {
      required: false,
      type: "multilink",
    }),
  ],
});
