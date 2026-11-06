import { defineBlock, defineField } from "@storyblok/schema";

import { mvpFolder } from "../../folders";

export const mvpBlock = defineBlock({
  name: "mvp",
  display_name: "MVP",
  is_root: true,
  is_nestable: false,
  folder: mvpFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  fields: [
    defineField("full_name", {
      description: "",
      required: true,
      translatable: false,
      type: "text",
    }),
    defineField("image", {
      description:
        "Please provide a PNG cut-out of the person's face and upper torso, with a transparent background. It should be square.",
      display_name: "Profile Photo",
      filetypes: ["images"],
      required: false,
      type: "asset",
    }),
    defineField("role", {
      type: "text",
    }),
    defineField("organization", {
      type: "text",
    }),
    defineField("location", {
      type: "text",
    }),
    defineField("teaser", {
      description: "Short description, used in preview cards.",
      display_name: "",
      max_length: 300,
      translatable: true,
      type: "textarea",
    }),
    defineField("about", {
      customize_toolbar: true,
      description: "Long description, used on MVP profile pages.",
      toolbar: [
        "bold",
        "unset",
        "italic",
        "link",
        "paragraph",
        "h2",
        "h3",
        "h4",
        "olist",
        "quote",
        "strike",
        "subscript",
        "superscript",
        "list",
        "inlinecode",
        "code",
      ],
      translatable: true,
      type: "richtext",
    }),
    defineField("tab-298d676e-e9ac-439d-ab47-486c0ebcf50b", {
      display_name: "Contributions",
      keys: ["mvp_program_entries", "mvp_contribution_entries"],
      type: "tab",
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
      description: "Their instagram username",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      tooltip: false,
      type: "text",
    }),
    defineField("linkedin_account", {
      default_value: "",
      description: "Their LinkedIn username",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("discord_account", {
      description:
        'Their discord user ID, which you can get by clicking on the three dots next to their profile and selecting the "Copy User ID" option.',
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("bluesky_account", {
      description: "Their bluesky username, excluding the @",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("x_account", {
      description: "Their X username, excluding the @",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("github_account", {
      description: "Their GitHub username",
      regex: "^(?!(http(s)?:\\/\\/)|(@)).*$",
      type: "text",
    }),
    defineField("mvp_program_entries", {
      allow: ["mvp_program_entry"],
      description:
        "A list of years in which this person has held the MVP title, and in which category. If the person has held the same title in the same category for multiple years, please create multiple entries, one per year.",
      display_name: "MVP Program Entries",
      minimum: 1,
      required: true,
      type: "bloks",
    }),
    defineField("mvp_contribution_entries", {
      allow: ["mvp_contribution_entry"],
      description:
        "A list of contributions to Storyblok. It can be a blog post written, video created, meeting held, etc.",
      display_name: "MVP Contribution Entries",
      type: "bloks",
    }),
  ],
});
