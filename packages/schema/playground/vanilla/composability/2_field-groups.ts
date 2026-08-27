import { defineField, hideWhen } from "@storyblok/schema";

export function seoFields() {
  return [
    defineField("seo_title", { type: "text", max_length: 70 }),
    defineField("seo_description", { type: "textarea", max_length: 160 }),
  ];
}

export function ctaFields() {
  return [
    defineField("cta_label", { type: "text", max_length: 40 }),
    defineField("cta_link", { type: "multilink" }),
  ];
}

export function styleFields() {
  return [
    defineField("background_image", { type: "asset", filetypes: ["images"] }),
    defineField("use_overlay", { type: "boolean", inline_label: true }),
    defineField("overlay_color", {
      type: "text",
      max_length: 7,
      // Inverted on purpose: the editor only offers "hide when". An unchecked
      // boolean counts as empty, but an untouched one is absent, which reads as
      // no match, so this is visible on a fresh story.
      conditional_settings: [hideWhen({ field: "use_overlay", is: "empty" })],
    }),
  ];
}
