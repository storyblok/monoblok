import { defineBlock, defineField } from "@storyblok/schema";

export const animatedTileBlock = defineBlock({
  name: "animated_tile",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/animated_tile.png",
  fields: [
    defineField("title", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("description", {
      required: true,
      translatable: true,
      type: "textarea",
    }),
    defineField("image", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("style", {
      default_value: "dark",
      exclude_empty_option: true,
      options: [
        {
          _uid: "8c4f2751-cb67-41c7-9a8a-017b4dfbb692",
          name: "Blue",
          value: "light",
        },
        {
          _uid: "1f9e87c0-6c24-47f3-9908-b27dac81e287",
          name: "Purple",
          value: "dark",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("cta_text", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("cta_link", {
      allow_target_blank: false,
      required: true,
      translatable: true,
      type: "multilink",
    }),
    defineField("bullet_points", {
      description: "One bullet point per row",
      translatable: true,
      type: "textarea",
    }),
  ],
});
