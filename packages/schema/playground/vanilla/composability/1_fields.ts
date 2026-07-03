import { defineField } from '@storyblok/schema';

// Named field entries reused across multiple blocks.
// Spread into schema arrays or override individual properties inline.
export const headlineField = defineField('headline', { type: 'text', max_length: 120 });
export const subtitleField = defineField('subtitle', { type: 'text', max_length: 200, translatable: true });
export const imageField = defineField('image', { type: 'asset', filetypes: ['images'] });
export const bodyField = defineField('body', {
  type: 'richtext',
  customize_toolbar: true,
  toolbar: ['bold', 'italic', 'link', 'h2', 'h3', 'list', 'olist', 'quote'],
});
export const themeOptionField = defineField('theme', {
  type: 'option',
  source: 'internal',
  datasource: 'themes',
});
