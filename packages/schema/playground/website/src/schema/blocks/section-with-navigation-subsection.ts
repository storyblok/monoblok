import { defineBlock, defineField } from "@storyblok/schema";

export const sectionWithNavigationSubsectionBlock = defineBlock({
  name: "section_with_navigation_subsection",
  is_root: false,
  is_nestable: true,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/section_with_navigation_subsection.png",
  preview_tmpl: "{{it.title}}",
  fields: [
    defineField("title", {
      required: true,
      type: "text",
    }),
    defineField("id_prefix", {
      description:
        "The ID of the subsection will be calculated from its title and optionally id_prefix. If multiple instances of SectionWithNavigationSubsection on the same page have the same title, id_prefix must be set to unique values for each subsection with a duplicate title.\n\nSubsection IDs are used to create links to subsections.",
      type: "text",
    }),
    defineField("blocks", {
      allow: [
        {
          tag: "Whitelist: Enterprise Body",
        },
      ],
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("tab-d1689bd0-444a-4b32-a42f-99e58d7ce111", {
      display_name: "Style",
      keys: ["accent_color"],
      type: "tab",
    }),
    defineField("accent_color", {
      datasource: "dark-colors-for-palette-plugin",
      field_type: "native-color-picker",
      options: [
        {
          name: "size",
          value: "",
        },
        {
          name: "defaultValue",
          value: "",
        },
        {
          name: "colors",
          value: "",
        },
      ],
      source: "internal",
      type: "custom",
    }),
  ],
});
