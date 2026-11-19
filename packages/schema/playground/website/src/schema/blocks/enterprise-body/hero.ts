import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const heroBlock = defineBlock({
  name: "hero",
  display_name: "Hero (deprecated)",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-lumber)",
  icon: "lock-open",
  image: "https://example.com/component-screenshots/hero.png",
  preview_tmpl: "<strong>{{ headline }}</strong>\n{{image(options.image.filename)/}} ",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("background_color", {
      options: [
        {
          _uid: "ce3b1e62-7cb8-4710-a812-5f9cb05e34c8",
          name: "Light with Circle",
          value: "light-circle",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("headline_size", {
      default_value: "normal",
      options: [
        {
          name: "Normal",
          value: "normal",
        },
        {
          name: "Large",
          value: "large",
        },
      ],
      type: "option",
    }),
    defineField("headline", {
      description:
        "This field is used to render an H1 title\n\nSnippets:\n[rotating]Some words here[/rotating]: rotating words, in combination with the rotating options field\n\n[color]Some words here[/color]: teal green text\n\n[sameline]Some words here[/sameline]: keep words on the same line",
      required: true,
      translatable: true,
      type: "textarea",
    }),
    defineField("rotating_text_options", {
      description: "Comma separated list of words for the rotating text",
      type: "text",
    }),
    defineField("text", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "link"],
      translatable: true,
      type: "richtext",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      display_name: "CTAs",
      maximum: 2,
      required: false,
      type: "bloks",
    }),
    defineField("image", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("video_url", {
      description: "Must be a youtube embed url:\nhttps://www.youtube.com/embed/PUT_VIDEO_ID_HERE",
      display_name: "Video URL",
      regex: "^https:\\/\\/www\\.youtube\\.com\\/embed\\/[\\w-]{11}(\\?[\\w&=-]*)?$",
      type: "text",
    }),
    defineField("tab-a119c44c-9f25-4cab-825d-a56008f20f8f", {
      display_name: "Style",
      keys: ["background_color", "headline_size"],
      type: "tab",
    }),
  ],
});
