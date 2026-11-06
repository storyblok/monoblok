import { defineBlock, defineField } from "@storyblok/schema";

export const demoFormG2ScoreBlock = defineBlock({
  name: "demo_form_g2_score",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  tags: ["Whitelist: Demo Form Side Content"],
  fields: [
    defineField("text", {
      customize_toolbar: true,
      toolbar: ["bold", "unset", "italic", "link"],
      type: "richtext",
    }),
  ],
});
