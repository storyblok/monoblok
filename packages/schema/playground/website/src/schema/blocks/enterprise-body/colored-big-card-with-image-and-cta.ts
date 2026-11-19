import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const coloredBigCardWithImageAndCtaBlock = defineBlock({
  name: "colored_big_card_with_image_and_cta",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/colored_big_card_with_image_and_cta.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
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
    defineField("cta", {
      allow: ["enterprise_cta"],
      maximum: 1,
      type: "bloks",
    }),
    defineField("background_color", {
      datasource: "light-colors-for-palette-plugin",
      field_type: "native-color-picker",
      options: [
        {
          name: "size",
          value: "",
        },
        {
          name: "defaultValue",
          value: "",
        },
        {
          name: "colors",
          value: "",
        },
      ],
      source: "internal",
      type: "custom",
    }),
    defineField("decorations", {
      options: [
        {
          _uid: "b2deeaf4-4071-453b-811c-25a1d4dc9270",
          name: "Swirl top",
          value: "swirl_top",
        },
        {
          _uid: "9645f07f-70ab-47b4-ade7-d9c9766f23d1",
          name: "Attention top",
          value: "attention_top",
        },
        {
          _uid: "7df019bc-ce82-4362-b5ba-675aae156ab7",
          name: "Attention bottom",
          value: "attention_bottom",
        },
        {
          _uid: "8409082f-bb74-41f2-aefc-395e784e12e7",
          name: "Stars bottom",
          value: "stars_bottom",
        },
      ],
      type: "options",
    }),
  ],
});
