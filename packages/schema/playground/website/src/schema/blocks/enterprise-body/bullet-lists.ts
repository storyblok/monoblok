import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const bulletListsBlock = defineBlock({
  name: "bullet_lists",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  description: "Responsible for containing 3 Bullet List bloks.",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/bullet_lists.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("items", {
      allow: ["bullet_list"],
      maximum: 3,
      minimum: 3,
      required: true,
      type: "bloks",
    }),
  ],
});
