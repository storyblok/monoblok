import { defineBlock, defineField } from "@storyblok/schema";

export const accordionCarouselItemBlock = defineBlock({
  name: "accordion_carousel_item",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/accordion_carousel_item.png",
  fields: [
    defineField("title", {
      required: true,
      type: "text",
    }),
    defineField("description", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "italic", "link"],
      type: "richtext",
    }),
    defineField("image", {
      required: true,
      type: "asset",
    }),
  ],
});
