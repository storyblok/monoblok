import { defineField, defineProp } from '@storyblok/schema';

// Using factories

export function seoFields(startPos: number) {
  return {
    seo_title: defineProp(
      defineField({ type: 'text', max_length: 70 }),
      { pos: startPos },
    ),
    seo_description: defineProp(
      defineField({ type: 'textarea', max_length: 160 }),
      { pos: startPos + 1 },
    ),
  };
}

export function ctaFields(startPos: number) {
  return {
    cta_label: defineProp(
      defineField({ type: 'text', max_length: 40 }),
      { pos: startPos },
    ),
    cta_link: defineProp(
      defineField({ type: 'multilink' }),
      { pos: startPos + 1 },
    ),
  };
}

export function styleFields(startPos: number) {
  return {
    background_image: defineProp(
      defineField({ type: 'asset', filetypes: ['images'] }),
      { pos: startPos },
    ),
    use_overlay: defineProp(
      defineField({ type: 'boolean', inline_label: true }),
      { pos: startPos + 1 },
    ),
    overlay_color: defineProp(
      defineField({
        type: 'text',
        max_length: 7,
        conditional_settings: [{ field: 'use_overlay', value: true }],
      }),
      { pos: startPos + 2 },
    ),
  };
}
