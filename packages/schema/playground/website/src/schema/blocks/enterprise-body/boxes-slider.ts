import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const boxesSliderBlock = defineBlock({
  name: "boxes_slider",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/boxes_slider.png",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body"],
  fields: [
    defineField("headline", {
      type: "text",
    }),
    defineField("text", {
      customize_toolbar: true,
      toolbar: ["bold", "italic", "link", "blok", "unset"],
      type: "richtext",
    }),
    defineField("boxes", {
      allow: ["boxes_slider_box"],
      minimum: 2,
      required: true,
      type: "bloks",
    }),
    defineField("tab-eb4bf533-cc36-4937-b036-866c08bccad5", {
      display_name: "Style",
      keys: ["images_size"],
      type: "tab",
    }),
    defineField("images_size", {
      default_value: " ",
      options: [
        {
          _uid: "7c2c7d6e-e5ad-4199-a161-ff8b091b20d4",
          name: "Default",
          value: "",
        },
        {
          _uid: "c4ee8e65-080e-4824-a42c-3a35123486da",
          name: "Square",
          value: "square",
        },
        {
          _uid: "2cff8355-c273-423f-838f-4a4940835e77",
          name: "Round",
          value: "round",
        },
        {
          _uid: "9aa34330-0be8-4d47-8a35-8a495dbfcaa8",
          name: "Round Small",
          value: "round-small",
        },
        {
          _uid: "5bd91355-353b-447d-b116-38feb9756fd4",
          name: "Portrait",
          value: "portrait",
        },
        {
          _uid: "d8258388-242b-4d99-bd61-ea0c21186a5b",
          name: "Portrait Small",
          value: "portrait-small",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
  ],
});
