import { defineBlock, defineField } from '@storyblok/schema';

export const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  display_name: 'Hero Banner',
  color: '#1b243f',
  fields: [
    defineField('headline', { type: 'text', max_length: 120, required: true }),
    defineField('subtitle', { type: 'text', max_length: 200, translatable: true }),
    defineField('image', { type: 'asset', filetypes: ['images'] }),
    defineField('cta_label', { type: 'text', max_length: 40 }),
    defineField('cta_link', { type: 'multilink' }),
    defineField('accent_color', { type: 'custom', field_type: 'storyblok-colorpicker' }),
  ],
});
