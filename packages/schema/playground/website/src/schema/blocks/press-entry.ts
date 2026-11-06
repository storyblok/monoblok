import { defineBlock, defineField } from "@storyblok/schema";

export const pressEntryBlock = defineBlock({
  name: "press_entry",
  display_name: "Press Entry",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("source_link", {
      default_value: "",
      description: "Full URL including https://",
      display_name: "",
      type: "multilink",
    }),
    defineField("source_name", {
      default_value: "",
      description: "The name of the external source",
      type: "text",
    }),
    defineField("preview_image", {
      filetypes: ["images"],
      type: "asset",
    }),
  ],
});
