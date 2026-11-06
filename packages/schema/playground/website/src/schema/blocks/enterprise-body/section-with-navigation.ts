import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const sectionWithNavigationBlock = defineBlock({
  name: "section_with_navigation",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/section_with_navigation.png",
  preview_tmpl:
    "{{@each(it.subsections) =&gt; subsection, index}}\n{{@if(index &gt; 0)}}, {{/if}}{{subsection.title}}\n{{/each}}",
  tags: ["Whitelist: Enterprise Body"],
  fields: [
    defineField("subsections", {
      allow: ["section_with_navigation_subsection"],
      minimum: 2,
      required: true,
      type: "bloks",
    }),
  ],
});
