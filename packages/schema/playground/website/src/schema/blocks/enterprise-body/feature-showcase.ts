import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const featureShowcaseBlock = defineBlock({
  name: "feature_showcase",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/feature_showcase.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("title", {
      customize_toolbar: true,
      description:
        'Please make sure to choose the appropriate Heading level.\nIf you need the headline to be on separate lines, please use "Shift" + "Enter" keyboard keys to start a new line.\nPlease don\'t use <br />.\nPlease don\'t use the "Enter" keyboard key on its own.',
      required: true,
      style_options: [
        {
          _uid: "e96522f1-6912-496c-bc91-d27b85aa61f4",
          name: "emphasis solid purple",
          value: "heading-emphasis-solid-purple",
        },
        {
          _uid: "f8107738-4429-4320-85ad-384cecc8040c",
          name: "emphasis solid blue",
          value: "heading-emphasis-solid-blue",
        },
        {
          _uid: "92621e1b-d624-4932-ab09-286672d6c9ad",
          name: "emphasis solid green",
          value: "heading-emphasis-solid-green",
        },
        {
          _uid: "6c3bf6ef-2a82-4f4a-98f1-c8705b0c5b1c",
          name: "emphasis solid yellow",
          value: "heading-emphasis-solid-yellow",
        },
        {
          _uid: "5bd61df9-8b7a-47e7-93d0-bd16ab5cfa56",
          name: "emphasis solid orange",
          value: "heading-emphasis-solid-orange",
        },
        {
          _uid: "a3fd153f-0fe1-421f-939f-ca683db466c1",
          name: "emphasis solid red",
          value: "heading-emphasis-solid-red",
        },
        {
          _uid: "5572094d-6659-480a-b79d-facc456996bd",
          name: "emphasis gradient purple",
          value: "heading-emphasis-gradient-purple",
        },
        {
          _uid: "152f0d94-cafc-4c83-8b7f-de6627480fa2",
          name: "emphasis gradient blue",
          value: "heading-emphasis-gradient-blue",
        },
        {
          _uid: "5ee1917a-c0b9-4887-85a0-454105684a1e",
          name: "emphasis gradient green",
          value: "heading-emphasis-gradient-green",
        },
        {
          _uid: "2e7c8e87-7046-44b2-b5dd-db579083f474",
          name: "emphasis gradient yellow",
          value: "heading-emphasis-gradient-yellow",
        },
        {
          _uid: "6b697f68-fe59-4fd8-b27e-a81c7e32c2cf",
          name: "emphasis gradient orange",
          value: "heading-emphasis-gradient-orange",
        },
        {
          _uid: "668a4395-c232-4119-bb06-b07bf76c2b14",
          name: "emphasis gradient red",
          value: "heading-emphasis-gradient-red",
        },
      ],
      toolbar: ["h2"],
      translatable: true,
      type: "richtext",
    }),
    defineField("description", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "italic", "link"],
      translatable: true,
      type: "richtext",
    }),
    defineField("cta", {
      allow: ["enterprise_cta"],
      maximum: 1,
      required: false,
      type: "bloks",
    }),
    defineField("image", {
      required: true,
      type: "asset",
    }),
    defineField("tab-7b371c98-b719-4fbc-af87-d497135e6071", {
      display_name: "Style",
      keys: ["show_corner_decoration"],
      type: "tab",
    }),
    defineField("video_asset", {
      type: "asset",
    }),
    defineField("tab-10d2ed18-afbf-432b-9d3a-64dc8f35931e", {
      display_name: "",
      type: "tab",
    }),
    defineField("show_corner_decoration", {
      type: "boolean",
    }),
    defineField("youtube_url", {
      default_value: "",
      description:
        "Must be a regular youtube url:\nhttps://www.youtube.com/watch?v=PUT_VIDEO_ID_HERE\n\nor a youtube embed url:\nhttps://www.youtube.com/embed/PUT_VIDEO_ID_HERE",
      display_name: "YouTube URL",
      regex:
        "^https:\\/\\/(www\\.)?youtube(-nocookie)?\\.com\\/(embed\\/|watch\\?v=)[\\w-]{11}([&?][\\w&=-]*)?$",
      type: "text",
    }),
    defineField("asset_position", {
      default_value: "rght",
      options: [
        {
          _uid: "d5253d8e-3592-4613-949f-51cd47ed13e8",
          name: "right",
          value: "right",
        },
        {
          _uid: "066252fb-40fe-4c15-9d8a-f1204326cf06",
          name: "left",
          value: "left",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
  ],
});
