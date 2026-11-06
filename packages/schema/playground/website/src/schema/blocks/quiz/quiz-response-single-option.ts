import { defineBlock, defineField } from "@storyblok/schema";

import { quizFolder } from "../../folders";

export const quizResponseSingleOptionBlock = defineBlock({
  name: "quiz_response_single_option",
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
    defineField("options", {
      allow: ["quiz_response_option"],
      description:
        "The order of options in a response is very important. The first option gives 0 points, with each subsequent option giving an additional point. For example, the 5th option will give 4 points.",
      required: true,
      type: "bloks",
    }),
  ],
});
