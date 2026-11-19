import { defineBlock, defineField } from "@storyblok/schema";

export const footnoteBlock = defineBlock({
  name: "footnote",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/footnote.png",
  fields: [
    defineField("text", {
      customize_toolbar: true,
      required: true,
      toolbar: [
        "bold",
        "list",
        "inlinecode",
        "unset",
        "italic",
        "link",
        "olist",
        "strike",
        "superscript",
        "subscript",
      ],
      translatable: true,
      type: "richtext",
    }),
  ],
});
