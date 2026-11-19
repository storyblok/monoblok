import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const sectionWithBulletListsAndOptionalVideoBlock = defineBlock({
  name: "section_with_bullet_lists_and_optional_video",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image:
    "https://example.com/component-screenshots/section_with_bullet_lists_and_optional_video.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("video_cover_image", {
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
                field_key: "video_url",
                type: "field",
              },
              validation: "not_empty",
            },
          ],
          rule_match: "any",
        },
      ],
      type: "asset",
    }),
    defineField("video_asset", {
      description: "Preferred over YouTube video",
      filetypes: ["videos"],
      type: "asset",
    }),
    defineField("video_url", {
      description: "Must be a youtube embed url:\nhttps://www.youtube.com/embed/PUT_VIDEO_ID_HERE",
      display_name: "Video URL",
      regex: "^https:\\/\\/www\\.youtube\\.com\\/embed\\/[\\w-]{11}(\\?[\\w&=-]*)?$",
      type: "text",
    }),
    defineField("video_caption", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "video_url",
                type: "field",
              },
              validation: "empty",
            },
            {
              validated_object: {
                field_attr: "value",
                field_key: "video_asset",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "all",
        },
      ],
      customize_toolbar: true,
      toolbar: ["bold"],
      type: "richtext",
    }),
    defineField("content", {
      allow: ["richtext_heading_with_description_and_ctas"],
      maximum: 1,
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("bullet_lists", {
      allow: ["bullet_list"],
      maximum: 2,
      minimum: 2,
      required: true,
      type: "bloks",
    }),
    defineField("background_color", {
      datasource: "lightest-colors-for-palette-plugin",
      field_type: "native-color-picker",
      options: [
        {
          name: "size",
          value: "",
        },
        {
          name: "defaultValue",
          value: "",
        },
        {
          name: "colors",
          value: "",
        },
      ],
      source: "internal",
      type: "custom",
    }),
    defineField("tab-50dfada3-baae-4794-be95-5761c4acae58", {
      display_name: "Styling Options",
      keys: ["background_color"],
      type: "tab",
    }),
    defineField("tab-6070e660-cb5f-41fb-bd7d-bc695f3d7953", {
      display_name: "Video Options",
      keys: ["video_cover_image", "video_url", "video_caption", "video_asset"],
      type: "tab",
    }),
  ],
});
