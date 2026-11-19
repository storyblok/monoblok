import { defineBlock, defineField } from "@storyblok/schema";

export const videoShowcaseSlideBlock = defineBlock({
  name: "video_showcase_slide",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/video_showcase_slide.png",
  fields: [
    defineField("video", {
      allow_advanced_search: true,
      entry_appearance: "link",
      filter_content_type: ["video_asset"],
      is_reference_type: true,
      max_options: "1",
      min_options: "1",
      required: true,
      source: "internal_stories",
      type: "options",
    }),
    defineField("background_color", {
      description: "",
      exclude_empty_option: true,
      options: [
        {
          _uid: "735c12e2-3222-41b2-aeb5-203513f80d5d",
          name: "red",
          value: "red",
        },
        {
          _uid: "24ea7b3f-3dc4-4c5c-91c5-2343286880e7",
          name: "orange",
          value: "orange",
        },
        {
          _uid: "c2e0c306-1fb4-40cb-b588-1d1d2bc9bbe9",
          name: "yellow",
          value: "yellow",
        },
        {
          _uid: "b5688caa-358b-4bc0-bf43-4933549aee51",
          name: "blue",
          value: "blue",
        },
        {
          _uid: "323da519-99b1-490d-8e03-3f21230a4ad7",
          name: "purple",
          value: "purple",
        },
        {
          _uid: "4bbd488b-8d5d-4ad1-8aaf-99b743cfe09d",
          name: "green",
          value: "green",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("custom_description", {
      customize_toolbar: true,
      toolbar: ["unset", "italic", "paragraph", "link", "bold", "superscript"],
      type: "richtext",
    }),
    defineField("display_speakers", {
      default_value: true,
      type: "boolean",
    }),
  ],
});
