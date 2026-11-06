import { defineBlock, defineField } from "@storyblok/schema";

export const inContentSharedContentBlock = defineBlock({
  name: "in_content_shared_content",
  display_name: "Shared Content for articles",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("content", {
      allow: [
        {
          tag: "Whitelist: Root Body",
        },
      ],
      type: "bloks",
    }),
  ],
});
