import { defineBlock, defineField } from "@storyblok/schema";

export const cookieGroupBlock = defineBlock({
  name: "cookie_group",
  is_root: false,
  is_nestable: true,
  image: "https://example.com/component-screenshots/cookie_group.png",
  fields: [
    defineField("name", {
      description:
        "The list of cookies that belong to this group is defined in the website's code.",
      type: "text",
    }),
    defineField("headline", {
      required: true,
      type: "text",
    }),
    defineField("text", {
      required: true,
      type: "textarea",
    }),
  ],
});
