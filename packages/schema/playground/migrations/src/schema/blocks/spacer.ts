import { defineBlock, defineField } from "@storyblok/schema";

export const spacerBlock = defineBlock({
  name: "spacer",
  is_nestable: true,
  fields: [
    defineField("height", {
      type: "option",
      options: [
        { name: "Small", value: "small" },
        { name: "Medium", value: "medium" },
        { name: "Large", value: "large" },
      ],
    }),
  ],
});
