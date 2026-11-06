import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const richtextHeadingWithDescriptionAndCtasBlock = defineBlock({
  name: "richtext_heading_with_description_and_ctas",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  image: "https://example.com/component-screenshots/richtext_heading_with_description_and_ctas.png",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body"],
  fields: [
    defineField("eyebrow", {
      type: "text",
    }),
    defineField("eyebrow_icon", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "eyebrow",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
      datasource: "lucide-icons",
      exclude_empty_option: true,
      source: "internal",
      type: "option",
      use_uuid: true,
    }),
    defineField("headline", {
      customize_toolbar: true,
      description:
        'Please make sure to choose the appropriate Heading level.\nIf you need the headline to be on separate lines, please use "Shift" + "Enter" keyboard keys to start a new line.\nPlease don\'t use <br />.\nPlease don\'t use the "Enter" keyboard key on its own.',
      required: true,
      style_options: [
        {
          _uid: "78f9f564-4c6d-4d11-9bf1-54397ef5683b",
          name: "emphasis solid purple",
          value: "heading-emphasis-solid-purple",
        },
        {
          _uid: "cd0e3c5f-40b1-4e1a-b07e-e75d5cf88157",
          name: "emphasis solid blue",
          value: "heading-emphasis-solid-blue",
        },
        {
          _uid: "e5ab7707-a411-4aa4-9de4-dd97f2e08e9d",
          name: "emphasis solid green",
          value: "heading-emphasis-solid-green",
        },
        {
          _uid: "2fe3cb08-2d57-4a62-b587-50df459e15f0",
          name: "emphasis solid yellow",
          value: "heading-emphasis-solid-yellow",
        },
        {
          _uid: "54734c60-ea00-4a21-94f8-cac3d71a2bce",
          name: "emphasis solid orange",
          value: "heading-emphasis-solid-orange",
        },
        {
          _uid: "13f3ea8e-1dfd-4c68-964b-c20848f84fee",
          name: "emphasis solid red",
          value: "heading-emphasis-solid-red",
        },
        {
          _uid: "10811aac-ada8-401f-aedc-dba5c45d58e4",
          name: "emphasis gradient purple",
          value: "heading-emphasis-gradient-purple",
        },
        {
          _uid: "7002f419-1681-49a2-baf1-7971b52218b7",
          name: "emphasis gradient blue",
          value: "heading-emphasis-gradient-blue",
        },
        {
          _uid: "260d03f9-eee4-4a9d-975b-0c8eb5127d1f",
          name: "emphasis gradient green",
          value: "heading-emphasis-gradient-green",
        },
        {
          _uid: "8c91943d-0955-471d-8b6b-b81b7b58df6f",
          name: "emphasis gradient yellow",
          value: "heading-emphasis-gradient-yellow",
        },
        {
          _uid: "38b76807-25b6-44c0-aa2a-43c9bf8d5f86",
          name: "emphasis gradient orange",
          value: "heading-emphasis-gradient-orange",
        },
        {
          _uid: "da6e3a33-9bb3-4380-b36a-a79535e66bd1",
          name: "emphasis gradient red",
          value: "heading-emphasis-gradient-red",
        },
      ],
      toolbar: ["h1", "h2", "h3", "superscript", "unset"],
      translatable: true,
      type: "richtext",
    }),
    defineField("description", {
      customize_toolbar: true,
      toolbar: ["bold", "italic", "link", "unset"],
      translatable: true,
      type: "richtext",
    }),
    defineField("ctas", {
      allow: ["enterprise_cta"],
      maximum: 2,
      type: "bloks",
    }),
    defineField("small_print_inline_image", {
      description: "Upload a small image. It will be inserted inline before the small print text.",
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("small_print_text", {
      type: "textarea",
    }),
    defineField("layout", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "ctas",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
      default_value: "column",
      exclude_empty_option: true,
      options: [
        {
          _uid: "2293d9a8-0eeb-491d-8f47-9f09993188f2",
          name: "Column",
          value: "column",
        },
        {
          _uid: "0dd23367-2036-4550-8f0e-deb52b1e333f",
          name: "Row",
          value: "row",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("headline_size", {
      default_value: "default",
      exclude_empty_option: true,
      options: [
        {
          _uid: "82778a10-08b1-47d6-813e-0edb59e67ff6",
          name: "Default",
          value: "default",
        },
        {
          _uid: "30de71ad-0c61-47db-90e8-a17a51d83cd6",
          name: "Large",
          value: "large",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("alignment", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "layout",
                type: "field",
              },
              validation: "equals",
              value: "row",
            },
            {
              validated_object: {
                field_attr: "value",
                field_key: "eyebrow",
                type: "field",
              },
              validation: "not_empty",
            },
          ],
          rule_match: "any",
        },
      ],
      default_value: "left",
      exclude_empty_option: true,
      options: [
        {
          _uid: "761438ce-00e7-4abb-ae94-ba351d5a75a7",
          name: "Left",
          value: "left",
        },
        {
          _uid: "0e1f4b3d-d9b1-4064-a0dd-2320cfa76d4b",
          name: "Center",
          value: "center",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("tab-deaa55b2-c344-469f-b15c-fe7ba76b0adb", {
      display_name: "Styling",
      keys: ["alignment", "layout", "headline_size", "eyebrow_accent_color"],
      type: "tab",
    }),
    defineField("eyebrow_accent_color", {
      conditional_settings: [
        {
          modifications: [
            {
              display: "hide",
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "eyebrow",
                type: "field",
              },
              validation: "empty",
            },
          ],
          rule_match: "any",
        },
      ],
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
