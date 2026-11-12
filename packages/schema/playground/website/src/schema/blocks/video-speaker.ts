import { defineBlock, defineField } from "@storyblok/schema";

export const videoSpeakerBlock = defineBlock({
  name: "video_speaker",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("image", {
      required: true,
      type: "asset",
    }),
    defineField("given_name", {
      required: true,
      type: "text",
    }),
    defineField("family_name", {
      type: "text",
    }),
    defineField("about", {
      type: "textarea",
    }),
    defineField("company", {
      type: "text",
    }),
    defineField("job_title", {
      type: "text",
    }),
  ],
});
