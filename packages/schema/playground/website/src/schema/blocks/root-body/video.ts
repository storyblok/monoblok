import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const videoBlock = defineBlock({
  name: "video",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/video.png",
  tags: ["Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("video_url", {
      description:
        "Should be a youtube embed url:\nhttps://www.youtube.com/embed/PUT_VIDEO_ID_HERE",
      regex: '^https:\\/\\/(?:(?!file\\.notion\\.so)[^\\s"])+$',
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("caption", {
      customize_toolbar: true,
      toolbar: ["bold", "link"],
      type: "richtext",
    }),
  ],
});
