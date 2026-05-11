import { defineField } from '@storyblok/schema';

export function seoFields() {
  return {
    seo_title: defineField({ type: 'text', max_length: 70 }),
    seo_description: defineField({ type: 'textarea', max_length: 160 }),
  };
}

export function ctaFields() {
  return {
    cta_label: defineField({ type: 'text', max_length: 40 }),
    cta_link: defineField({ type: 'multilink' }),
  };
}

export function styleFields() {
  return {
    background_image: defineField({ type: 'asset', filetypes: ['images'] }),
    use_overlay: defineField({ type: 'boolean', inline_label: true }),
    overlay_color: defineField({
      type: 'text',
      max_length: 7,
      conditional_settings: [{ field: 'use_overlay', value: true }],
    }),
  };
}
