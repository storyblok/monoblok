import { defineBlock, defineField } from "@storyblok/schema";

export const authorBlock = defineBlock({
  name: "author",
  display_name: "Author",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("image", {
      display_name: "Image",
      required: true,
      type: "asset",
    }),
    defineField("given_name", {
      description: "This field is used to render an H1 title",
      required: true,
      type: "text",
    }),
    defineField("family_name", {
      conditional_settings: [
        {
          modifications: [
            {
              required: true,
            },
          ],
          rule_conditions: [
            {
              validated_object: {
                field_attr: "value",
                field_key: "skip_family_name",
                type: "field",
              },
              validation: "not_equals",
              value: true,
            },
          ],
          rule_match: "any",
        },
      ],
      description: "This field is used to render an H1 title",
      required: false,
      type: "text",
    }),
    defineField("about", {
      customize_toolbar: true,
      toolbar: ["bold", "unset", "italic", "link", "paragraph"],
      type: "richtext",
    }),
    defineField("email", {
      type: "text",
    }),
    defineField("skip_family_name", {
      description: "Turn on if this author does not have a family name.",
      display_name: "Publishes under a pseudonym",
      type: "boolean",
    }),
    defineField("tab-6e8748a6-9ef3-46f6-900c-ecf8c2c6e787", {
      display_name: "Social",
      keys: [
        "github_account",
        "x_account",
        "discord_account",
        "linkedin_account",
        "instagram_account",
        "bluesky_account",
      ],
      type: "tab",
    }),
    defineField("instagram_account", {
      default_value: "",
      description: "Your instagram username",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      tooltip: false,
      type: "text",
    }),
    defineField("linkedin_account", {
      default_value: "",
      description: "Your LinkedIn username",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("discord_account", {
      description:
        'Your discord user ID, which you can get by clicking on the three dots next to your profile and selecting the "Copy User ID" option.',
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("bluesky_account", {
      description: "Your bluesky username, excluding the @",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("x_account", {
      description: "Your X username, excluding the @",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("github_account", {
      description: "Your GitHub username",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
  ],
});
