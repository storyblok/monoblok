import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseBoxGridBlock = defineBlock({
  name: "enterprise_box_grid",
  display_name: "Box Grid",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_box_grid.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("variant", {
      default_value: "default",
      description:
        "The default value is 'Default' and has no effect on the styling. The 'New Homepage Style' variant applies styling specific to an upcoming Homepage design update.",
      display_name: "Variant",
      options: [
        {
          _uid: "3ddbafc1-7522-4eb1-990d-01d6feb3340e",
          name: "Default",
          value: "default",
        },
        {
          _uid: "86462d9d-e9e9-4d7f-aa98-f87a6864287c",
          name: "New Homepage Style",
          value: "new-homepage-style",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("body", {
      allow: ["enterprise_box"],
      type: "bloks",
    }),
    defineField("content_align", {
      default_value: "left",
      options: [
        {
          _uid: "01f368b4-ad4b-4128-9d87-7a10474ecc94",
          name: "Center",
          value: "center",
        },
        {
          _uid: "d212d6ad-2004-42af-aff7-25cf151e7f74",
          name: "Top",
          value: "top",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("images_size", {
      exclude_empty_option: true,
      options: [
        {
          name: "Large",
          value: "large",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("tab-c1bb18d2-d50b-43b8-85de-e27dd5d4c69c", {
      display_name: "Style",
      keys: ["content_align", "image_size", "images_size", "vraint", "variant"],
      type: "tab",
    }),
  ],
});
