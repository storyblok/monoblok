import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const customTableBlock = defineBlock({
  name: "custom_table",
  display_name: "Table",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/custom_table.png",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("entries", {
      translatable: true,
      type: "table",
    }),
    defineField("caption", {
      translatable: true,
      type: "text",
    }),
  ],
});
