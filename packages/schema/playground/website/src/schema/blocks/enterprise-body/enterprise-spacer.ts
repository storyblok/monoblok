import { defineBlock, defineField } from "@storyblok/schema";

import { enterpriseBodyFolder } from "../../folders";

export const enterpriseSpacerBlock = defineBlock({
  name: "enterprise_spacer",
  display_name: "Spacer",
  is_root: false,
  is_nestable: true,
  folder: enterpriseBodyFolder,
  image: "https://example.com/component-screenshots/enterprise_spacer.png",
  preview_tmpl:
    "{{if(options.spacer_height)}}\n<div>Height: <strong>{{spacer_height}}</strong>\n</div>\n{{/if}}\n{{if(options.horizontal_line)}}\n<div><strong>Horizontal Line: active</strong></div>\n{{/if}}\n{{if(options.background_active)}}\n<div><strong>Background: Active</strong></div>\n{{if(options.background_height !== '')}}\n<div>Background Height: <strong>{{background_height}}px</strong>\n</div>\n{{/if}}\n{{/if}}",
  tags: ["Whitelist: Enterprise Body", "Whitelist: Root Body", "Whitelist: Blog Entry Body"],
  fields: [
    defineField("spacer_height", {
      default_value: "30",
      description: "",
      exclude_empty_option: true,
      options: [
        {
          _uid: "a70f7676-1e5a-45b4-a038-5ec1716e7bee",
          name: "30",
          value: "30",
        },
        {
          _uid: "9d1185c2-d581-4be8-bf23-6643f39ccbf6",
          name: "80",
          value: "80",
        },
        {
          _uid: "cb86d098-dbbc-4467-9658-65e5d9838f04",
          name: "100",
          value: "100",
        },
        {
          _uid: "9ff53e85-d1af-4688-9177-b479359d4d40",
          name: "160",
          value: "160",
        },
      ],
      required: true,
      type: "option",
      use_uuid: true,
    }),
    defineField("horizontal_line", {
      type: "boolean",
    }),
    defineField("background_active", {
      type: "boolean",
    }),
    defineField("background_height", {
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
                field_key: "background_active",
                type: "field",
              },
              validation: "not_equals",
              value: true,
            },
          ],
          rule_match: "any",
        },
      ],
      type: "number",
    }),
    defineField("background_width", {
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
                field_key: "background_active",
                type: "field",
              },
              validation: "not_equals",
              value: true,
            },
          ],
          rule_match: "any",
        },
      ],
      type: "number",
    }),
    defineField("background_color", {
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
                field_key: "background_active",
                type: "field",
              },
              validation: "not_equals",
              value: true,
            },
          ],
          rule_match: "any",
        },
      ],
      description: "Format: r, g, b (example: 246,248,249)",
      regex: "^(\\d{1,3}),(\\d{1,3}),(\\d{1,3})$",
      type: "text",
    }),
  ],
});
