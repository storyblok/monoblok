import { defineBlock, defineField } from "@storyblok/schema";

import { configurationFolder } from "../../folders";

export const configurationBlock = defineBlock({
  name: "configuration",
  display_name: "Configuration",
  is_root: true,
  is_nestable: false,
  folder: configurationFolder,
  color: "var(--sb-color-accent-background-green-cyan)",
  icon: "mouse-pointer",
  fields: [
    defineField("default_blog_entry_preview_image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("newsletter_form_success_headline", {
      required: true,
      translatable: true,
      type: "text",
    }),
    defineField("newsletter_form_success_message", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "italic", "link", "strike", "superscript", "subscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("newsletter_form_error_generic", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "link", "italic", "superscript", "subscript", "strike"],
      translatable: true,
      type: "richtext",
    }),
    defineField("newsletter_form_error_no_group", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "italic", "link", "subscript", "strike", "superscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("newsletter_form_error_invalid_address", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "italic", "link", "strike", "subscript", "superscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("newsletter_form_error_duplicate_address", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "link", "italic", "strike", "superscript", "subscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("default_og_image", {
      filetypes: ["images"],
      type: "asset",
    }),
    defineField("global_announcement", {
      customize_toolbar: true,
      description:
        "Announcement text that will be visible on every page without the ability to dismiss it. Use wisely.\n\nExcluded from `/a/` pages.",
      toolbar: ["bold", "italic", "link", "unset", "strike", "subscript", "superscript"],
      type: "richtext",
    }),
    defineField("cookie_consent_notice", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "link", "italic", "strike", "subscript", "superscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("tab-3dd232d8-5b20-460e-8d21-4ee2cc7c6cb2", {
      display_name: "Navigation",
      keys: ["header", "new_header", "new_footer", "new_footer_socials"],
      type: "tab",
    }),
    defineField("contact_form_privacy", {
      allow_target_blank: true,
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "italic", "link", "strike", "subscript", "superscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("tab-c32c5af8-117c-4fa3-b814-17861c6dced8", {
      display_name: "Contact Form",
      keys: [
        "contact_form_success",
        "contact_form_failed",
        "contact_form_invalid",
        "contact_form_privacy",
      ],
      type: "tab",
    }),
    defineField("contact_form_success", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "italic", "link", "strike", "subscript", "superscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("tab-aaa8a9f3-d8a6-4810-9ad5-2c1d36b35b13", {
      display_name: "Gated Content",
      keys: ["gated_content_success"],
      type: "tab",
    }),
    defineField("contact_form_failed", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "italic", "link", "strike", "subscript", "superscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("tab-64641b26-d333-4efd-9d4a-466f5fd84cd6", {
      display_name: "Newsletter Form",
      keys: [
        "newsletter_form_success_headline",
        "newsletter_form_success_message",
        "newsletter_form_error_generic",
        "newsletter_form_error_no_group",
        "newsletter_form_error_invalid_address",
        "newsletter_form_error_duplicate_address",
      ],
      type: "tab",
    }),
    defineField("contact_form_invalid", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "italic", "link", "strike", "subscript", "superscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("tab-933aaf8b-2d7f-455d-a644-fb3a93b35b3f", {
      display_name: "Blog",
      keys: ["default_blog_entry_preview_image"],
      type: "tab",
    }),
    defineField("gated_content_success", {
      customize_toolbar: true,
      required: true,
      toolbar: ["bold", "unset", "italic", "link", "strike", "superscript", "subscript"],
      translatable: true,
      type: "richtext",
    }),
    defineField("new_header", {
      allow: ["navigation_menu", "navigation_item"],
      description: "",
      display_name: "Main Navigation",
      required: false,
      type: "bloks",
    }),
    defineField("new_footer", {
      allow: ["navigation_group"],
      display_name: "Footer",
      type: "bloks",
    }),
    defineField("new_footer_socials", {
      allow: ["footer_social"],
      display_name: "Footer Socials",
      type: "bloks",
    }),
  ],
});
