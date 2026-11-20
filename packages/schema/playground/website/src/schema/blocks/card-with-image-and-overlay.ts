import { defineBlock, defineField } from "@storyblok/schema";

export const cardWithImageAndOverlayBlock = defineBlock({
  name: "card_with_image_and_overlay",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/card_with_image_and_overlay.png",
  fields: [
    defineField("title", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("text", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold"],
      translatable: true,
      type: "richtext",
    }),
    defineField("image", {
      required: true,
      type: "asset",
    }),
    defineField("link", {
      translatable: true,
      type: "multilink",
    }),
    defineField("logo", {
      type: "asset",
    }),
  ],
});
