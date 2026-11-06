import { defineBlock, defineField } from "@storyblok/schema";

export const newQuoteBlock = defineBlock({
  name: "new_quote",
  display_name: "Quote",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("text", {
      description: "Do not include quotation marks.",
      display_name: "Text",
      required: true,
      translatable: true,
      type: "textarea",
    }),
    defineField("given_name", {
      required: true,
      type: "text",
    }),
    defineField("family_name", {
      description: "Leave empty for people who go by one name.",
      type: "text",
    }),
    defineField("image", {
      description: "",
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("role", {
      description:
        "This field is used to display additional information - mainly the role/company/job title - related to the person.",
      translatable: true,
      type: "text",
    }),
  ],
});
