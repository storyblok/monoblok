import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const bannerSectionBlock = defineBlock({
  name: "banner_section",
  display_name: "Banner Section (deprecated)",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock",
  image: "https://example.com/component-screenshots/banner_section.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("logo", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("sub_headline", {
      translatable: true,
      type: "text",
    }),
    defineField("headline", {
      description: "This field is used to render an H1 title",
      translatable: true,
      type: "textarea",
    }),
    defineField("image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      maximum: 2,
      type: "bloks",
    }),
    defineField("video_url", {
      description: "Must be a youtube embed url:\nhttps://www.youtube.com/embed/PUT_VIDEO_ID_HERE",
      regex: "^https:\\/\\/www\\.youtube\\.com\\/embed\\/[\\w-]{11}(\\?[\\w&=-]*)?$",
      type: "text",
    }),
  ],
});
