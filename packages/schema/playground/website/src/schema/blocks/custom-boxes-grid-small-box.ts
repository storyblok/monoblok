import { defineBlock, defineField } from "@storyblok/schema";

export const customBoxesGridSmallBoxBlock = defineBlock({
  name: "custom_boxes_grid_small_box",
  display_name: "Small Box",
  is_root: false,
  is_nestable: true,
  image: "https://example.com/component-screenshots/custom_boxes_grid_small_box.png",
  preview_tmpl: "<div>1 column</div>\n<strong>{{headline}}</strong>",
  fields: [
    defineField("image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("headline", {
      type: "text",
    }),
    defineField("content", {
      customize_toolbar: true,
      max_length: 400,
      toolbar: ["bold", "unset", "italic", "paragraph"],
      type: "richtext",
    }),
    defineField("link", {
      allow_target_blank: true,
      type: "multilink",
    }),
  ],
});
