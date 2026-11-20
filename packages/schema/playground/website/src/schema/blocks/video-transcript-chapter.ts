import { defineBlock, defineField } from "@storyblok/schema";

export const videoTranscriptChapterBlock = defineBlock({
  name: "video_transcript_chapter",
  is_root: false,
  is_nestable: true,
  image: "https://example.com/component-screenshots/video_transcript_chapter.png",
  preview_tmpl: "{{name}}",
  fields: [
    defineField("starting_time", {
      description: "",
      display_name: "Starting time (seconds)",
      max_length: "",
      type: "text",
    }),
    defineField("name", {
      type: "text",
    }),
    defineField("excerpt", {
      max_length: "90",
      type: "textarea",
    }),
    defineField("body", {
      allow: [
        {
          tag: "Whitelist: Root Body",
        },
      ],
      type: "bloks",
    }),
  ],
});
