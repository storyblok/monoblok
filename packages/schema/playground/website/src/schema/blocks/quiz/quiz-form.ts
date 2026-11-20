import { defineBlock, defineField } from "@storyblok/schema";

import { quizFolder } from "../../folders";

export const quizFormBlock = defineBlock({
  name: "quiz_form",
  is_root: false,
  is_nestable: true,
  folder: quizFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/quiz_form.png",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("configuration", {
      filter_content_type: ["quiz_configuration"],
      required: true,
      source: "internal_stories",
      type: "option",
      use_uuid: true,
    }),
  ],
});
