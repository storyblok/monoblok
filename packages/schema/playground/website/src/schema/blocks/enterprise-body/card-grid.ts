import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const cardGridBlock = defineBlock({
  name: "card_grid",
  display_name: "Card Grid",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/card_grid.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("subheadline", {
      type: "text",
    }),
    defineField("headline", {
      customize_toolbar: true,
      toolbar: ["h2", "h3", "italic", "bold"],
      type: "richtext",
    }),
    defineField("cards", {
      allow: ["card_with_image_and_overlay", "card_with_logo", "card_with_text"],
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("tab-ec798bdb-f296-41c7-8f0c-c23545dda45b", {
      display_name: "Content",
      keys: ["headline", "subheadline", "cards"],
      type: "tab",
    }),
    defineField("alignment", {
      default_value: "left",
      description: "Aligns headline and subheadline if present. ",
      exclude_empty_option: true,
      options: [
        {
          _uid: "2856d719-f74b-424a-adac-608a8f583804",
          name: "Left",
          value: "left",
        },
        {
          _uid: "7e64c41f-97dc-41fa-a9a1-dc1bd17b28fc",
          name: "Center",
          value: "center",
        },
      ],
      required: false,
      type: "option",
      use_uuid: true,
    }),
    defineField("tab-a9904bec-2959-4f55-bccf-a2c20dd4ae2c", {
      display_name: "Design",
      keys: ["alignment", "card_width"],
      type: "tab",
    }),
    defineField("card_width", {
      default_value: "narrow",
      description:
        "Target width of cards. Cards may grow/shrink to better fit the layout and content.",
      options: [
        {
          _uid: "0ac47568-7761-454d-8571-324631c75979",
          name: "Narrow",
          value: "narrow",
        },
        {
          _uid: "229772c8-fb1c-46f7-a99a-a290392948c2",
          name: "Full",
          value: "full",
        },
      ],
      required: false,
      type: "option",
      use_uuid: true,
    }),
  ],
});
