import { defineBlock, defineField } from "@storyblok/schema";

import { rootBodyFolder } from "../../folders";

export const imageBlock = defineBlock({
  name: "image",
  is_root: false,
  is_nestable: true,
  folder: rootBodyFolder,
  image: "https://example.com/component-screenshots/image.png",
  preview_tmpl: "<div>{{alt}}</div>\n{{image(options.source.filename)/}}",
  tags: ["Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("source", {
      filetypes: ["images"],
      required: true,
      type: "asset",
    }),
    defineField("link", {
      type: "text",
    }),
    defineField("caption", {
      customize_toolbar: true,
      translatable: true,
      type: "richtext",
    }),
    defineField("disable_lightbox", {
      type: "boolean",
    }),
    defineField("above", {
      type: "boolean",
    }),
    defineField("centered", {
      type: "boolean",
    }),
    defineField("rounded_corners", {
      type: "boolean",
    }),
    defineField("add_shadow", {
      type: "boolean",
    }),
    defineField("width", {
      description:
        "This will set a max width on the image and a small margin bottom. Include the unit in the value. Es: 300px, 30%, 10rem",
      type: "text",
    }),
    defineField("height", {
      default_value: "",
      description: "Deprecated. If you want to set a custom size use the Width field instead.",
      display_name: "Height (deprecated)",
      type: "text",
    }),
    defineField("browser_bar", {
      description: "Display a browser bar above the image. Leave blank to hide it.",
      options: [
        {
          name: "Dark",
          value: "dark",
        },
        {
          name: "Light",
          value: "light",
        },
      ],
      type: "option",
      use_uuid: true,
    }),
    defineField("browser_bar_address", {
      description:
        'This is the text in the browser\'s address bar. Leave it empty to have the default "storyblok.com".',
      type: "text",
    }),
    defineField("tab-a1ee05c5-9f75-47cd-bfac-02ce329891d9", {
      display_name: "Settings",
      keys: [
        "styles",
        "centered",
        "above",
        "add_shadow",
        "original_size",
        "width",
        "disable_lightbox",
        "height",
        "user_original",
        "rounded_corners",
      ],
      type: "tab",
    }),
    defineField("tab-5da91c5f-b9f3-4190-8f02-bfb64e836933", {
      display_name: "Browser",
      keys: ["browser_bar", "browser_bar_address"],
      type: "tab",
    }),
  ],
});
