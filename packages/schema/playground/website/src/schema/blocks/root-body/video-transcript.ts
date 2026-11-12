import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const videoTranscriptBlock = defineBlock({
  name: "video_transcript",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/video_transcript.png",
  tags: ["Whitelist: Root Body"],
  fields: [
    defineField("video_id", {
      display_name: "YouTube Video ID",
      type: "text",
    }),
    defineField("intro", {
      type: "richtext",
    }),
    defineField("chapters", {
      allow: ["video_transcript_chapter"],
      type: "bloks",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      display_name: "CTAs",
      type: "bloks",
    }),
  ],
});
