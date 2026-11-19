import { defineBlock, defineField } from "@storyblok/schema";

import { mvpFolder } from "../../folders";

export const mvpProgramEntryBlock = defineBlock({
  name: "mvp_program_entry",
  display_name: "MVP Program Entry",
  is_root: false,
  is_nestable: true,
  folder: mvpFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  preview_tmpl: "{{it.year}} {{it.category}}",
  fields: [
    defineField("year", {
      decimals: 0,
      max_value: 3000,
      min_value: 2000,
      required: true,
      steps: 1,
      type: "number",
    }),
    defineField("category", {
      datasource: "mvp-categories",
      exclude_empty_option: true,
      options: [
        {
          _uid: "ca88ff5b-6ba4-4402-9d1a-6b956a4ec09b",
          name: "Builder",
          value: "builder",
        },
        {
          _uid: "925bee75-2743-4dca-b89d-4c97ba93f6f3",
          name: "Changemaker",
          value: "changemaker",
        },
        {
          _uid: "64f1ebf1-1546-4c04-8793-cded09bc442e",
          name: "Collaborator",
          value: "collaborator",
        },
        {
          _uid: "aaac69be-7740-4c5f-b26b-007a96dc2e95",
          name: "Advisor",
          value: "advisor",
        },
        {
          _uid: "e6ccedf4-34ea-4668-a32f-5722879c7b05",
          name: "Legend",
          value: "legend",
        },
      ],
      required: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
  ],
});
