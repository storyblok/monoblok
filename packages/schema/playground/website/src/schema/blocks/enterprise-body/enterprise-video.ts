import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseVideoBlock = defineBlock({
  name: "enterprise_video",
  display_name: "Video Section",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("headline", {
      description: "Screenreader only.",
      type: "text",
    }),
    defineField("thumbnail", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("video_asset", {
      conditional_settings: [
        {
          modifications: [
            {
              required: true,
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "youtube_url",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
      description: "Preferred and prioritized over YouTube video",
      filetypes: ["videos"],
      type: "asset",
    }),
    defineField("youtube_url", {
      conditional_settings: [
        {
          modifications: [
            {
              required: true,
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "video_asset",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
      default_value: "",
      description:
        "Must be a regular youtube url: \nhttps://www.youtube.com/watch?v=PUT_VIDEO_ID_HERE\n\nor a youtube embed url:\nhttps://www.youtube.com/embed/PUT_VIDEO_ID_HERE",
      display_name: "Youtube URL",
      regex:
        "^https:\\/\\/(www\\.)?youtube(-nocookie)?\\.com\\/(embed\\/|watch\\?v=)[\\w-]{11}([&?][\\w&=-]*)?$",
      type: "text",
    }),
    defineField("tab-efadcccd-b8fc-4a93-8aaf-2384c53e1280", {
      display_name: "Options",
      keys: ["size"],
      type: "tab",
    }),
    defineField("size", {
      exclude_empty_option: true,
      options: [
        {
          _uid: "8ef4b228-e6d1-4ad0-937b-15ddc6e7fe04",
          name: "default",
          value: "default",
        },
        {
          _uid: "3aea3799-2a43-41d5-bdea-76929e3f9b79",
          name: "large",
          value: "large",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
  ],
});
