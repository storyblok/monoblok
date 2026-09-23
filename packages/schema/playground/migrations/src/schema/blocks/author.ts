import { defineBlock, defineField } from "@storyblok/schema";

export const authorBlock = defineBlock({
  name: "author",
  is_nestable: true,
  fields: [
    defineField("first_name", { type: "text", max_length: 80 }),
    defineField("last_name", { type: "text", max_length: 80 }),
    defineField("bio", { type: "textarea" }),
    defineField("avatar", { type: "asset", filetypes: ["images"] }),
  ],
});
