import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const quotesBlock = defineBlock({
  name: "quotes",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/quotes.png",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("quotes", {
      allow: ["quotes_item"],
      minimum: 1,
      required: true,
      type: "bloks",
    }),
  ],
});
