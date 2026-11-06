import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const inContentNestedSharedContentBlock = defineBlock({
  name: "in_content_nested_shared_content",
  display_name: "Shared Content",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/in_content_nested_shared_content.png",
  preview_field: "content",
  tags: ["Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("content", {
      filter_content_type: ["in_content_shared_content"],
      folder_slug: "shared-content/",
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
  ],
});
