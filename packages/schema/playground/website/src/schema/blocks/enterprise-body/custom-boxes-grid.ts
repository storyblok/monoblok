import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const customBoxesGridBlock = defineBlock({
  name: "custom_boxes_grid",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/custom_boxes_grid.png",
  preview_tmpl: "{{each(options.boxes)}}\n<div>{{@this.headline}}</div>\n{{/each}}",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("boxes", {
      allow: ["custom_boxes_grid_small_box"],
      type: "bloks",
    }),
    defineField("columns", {
      default_value: "3",
      exclude_empty_option: true,
      options: [
        {
          name: "2",
          value: "2",
        },
        {
          name: "3",
          value: "3",
        },
        {
          name: "4",
          value: "4",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("images_position", {
      default_value: " ",
      options: [
        {
          name: "Top",
          value: " ",
        },
        {
          name: "Inline",
          value: "inline",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
  ],
});
