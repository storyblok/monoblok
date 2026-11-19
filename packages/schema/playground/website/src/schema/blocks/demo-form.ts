import { defineBlock, defineField } from "@storyblok/schema";

export const demoFormBlock = defineBlock({
  name: "demo_form",
  display_name: "Demo Form",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/demo_form.png",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body"],
  fields: [
    defineField("side_content", {
      allow: [
        {
          tag: "Whitelist: Demo Form Side Content",
        },
      ],
      type: "bloks",
    }),
    defineField("cta_text", {
      default_value: "Book a Demo",
      required: true,
      type: "text",
    }),
  ],
});
