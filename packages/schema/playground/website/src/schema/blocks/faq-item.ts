import { defineBlock, defineField } from "@storyblok/schema";

export const faqItemBlock = defineBlock({
  name: "faq_item",
  is_root: false,
  is_nestable: true,
  image: "https://example.com/component-screenshots/faq_item.png",
  preview_field: "question",
  fields: [
    defineField("question", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("answer", {
      customize_toolbar: true,
      display_name: "Answer",
      required: true,
      toolbar: [
        "bold",
        "list",
        "inlinecode",
        "unset",
        "italic",
        "link",
        "olist",
        "subscript",
        "superscript",
        "strike",
      ],
      translatable: true,
      type: "richtext",
    }),
  ],
});
