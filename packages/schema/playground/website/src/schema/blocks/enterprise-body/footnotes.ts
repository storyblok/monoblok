import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const footnotesBlock = defineBlock({
  name: "footnotes",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/footnotes.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("heading", {
      customize_toolbar: true,
      description: "Please make sure to choose the appropriate Heading level.",
      required: true,
      toolbar: ["h1", "h2", "h3", "h4", "superscript", "subscript", "italic"],
      translatable: true,
      type: "richtext",
    }),
    defineField("footnotes", {
      allow: ["footnote"],
      description:
        'You can link to a specific footnote from any piece of content that allows inserting a link. Set "#footnote-1" as the link\'s href to link to the first footnote and so on.\n\nYou can only use a single Footnotes component on a page.',
      minimum: 1,
      required: true,
      type: "bloks",
    }),
  ],
});
