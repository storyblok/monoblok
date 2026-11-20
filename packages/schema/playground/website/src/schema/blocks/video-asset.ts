import { defineBlock, defineField } from "@storyblok/schema";

export const videoAssetBlock = defineBlock({
  name: "video_asset",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("source", {
      filetypes: ["videos"],
      required: true,
      type: "asset",
    }),
    defineField("thumbnail", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("title", {
      required: true,
      type: "text",
    }),
    defineField("description", {
      type: "textarea",
    }),
    defineField("speakers_featured", {
      allow_advanced_search: true,
      entry_appearance: "card",
      filter_content_type: ["video_speaker"],
      folder_slug: "",
      is_reference_type: true,
      source: "internal_stories",
      type: "options",
    }),
  ],
});
