import { defineBlock, defineField } from "@storyblok/schema";

import { quizFolder } from "../../folders";

export const quizCategoryBlock = defineBlock({
  name: "quiz_category",
  is_root: false,
  is_nestable: true,
  folder: quizFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  description: "Quiz Category",
  icon: "mouse-pointer",
  fields: [
    defineField("name", {
      regex: "^[a-z-]+$",
      required: true,
      type: "text",
    }),
    defineField("label", {
      display_name: "Label",
      regex: "",
      required: false,
      type: "text",
    }),
    defineField("responses", {
      allow: ["quiz_response_single_option"],
      display_name: "Responses",
      minimum: 1,
      required: true,
      type: "bloks",
    }),
  ],
});
