import { defineBlock, defineField } from "@storyblok/schema";

export const demoFormLogosBlock = defineBlock({
  name: "demo_form_logos",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  tags: ["Whitelist: Demo Form Side Content"],
  fields: [
    defineField("logos", {
      filetypes: ["images"],
      required: true,
      type: "multiasset",
    }),
  ],
});
