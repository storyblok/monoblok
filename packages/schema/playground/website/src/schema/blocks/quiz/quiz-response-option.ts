import { defineBlock, defineField } from "@storyblok/schema";

import { quizFolder } from "../../folders";

export const quizResponseOptionBlock = defineBlock({
  name: "quiz_response_option",
  is_root: false,
  is_nestable: true,
  folder: quizFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  fields: [
    defineField("label", {
      required: true,
      type: "text",
    }),
  ],
});
