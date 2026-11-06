import { defineBlock, defineField } from "@storyblok/schema";

export const cardWithLogoBlock = defineBlock({
  name: "card_with_logo",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/card_with_logo.png",
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
    defineField("logo", {
      required: true,
      type: "asset",
    }),
    defineField("link", {
      translatable: true,
      type: "multilink",
    }),
    defineField("tab-0191221a-84d2-480b-8637-924d2400241f", {
      display_name: "Style options",
      keys: ["custom_background_color"],
      type: "tab",
    }),
    defineField("custom_background_color", {
      default_value:
        "Do not use those colors for content that is not associated with the brand that it represents.\n\nIf you need more colors, contact the Website Team.",
      description: "",
      exclude_empty_option: true,
      options: [
        {
          _uid: "ef107415-389b-484f-9652-2bb9cc8396f8",
          name: "Gartner blue",
          value: "#F0F9FE",
        },
        {
          _uid: "6031180d-5db6-4606-987c-083b064e0ad2",
          name: "Forrester green",
          value: "#ECF1F0",
        },
        {
          _uid: "d1a15c2c-b9d1-4dc7-aeae-95b1130a91fb",
          name: "G2 orange",
          value: "#FEF3EE",
        },
      ],
      regex: "",
      type: "option",
      use_uuid: true,
    }),
  ],
});
