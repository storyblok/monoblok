import { defineBlock, defineField } from "@storyblok/schema";

export const timelineStepBlock = defineBlock({
  name: "timeline_step",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/timeline_step.png",
  fields: [
    defineField("content", {
      customize_toolbar: true,
      required: true,
      toolbar: [
        "bold",
        "list",
        "h2",
        "h3",
        "h4",
        "italic",
        "link",
        "olist",
        "strike",
        "superscript",
        "subscript",
      ],
      type: "richtext",
    }),
  ],
});
