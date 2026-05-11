import { defineField } from '@storyblok/schema';

export const headlineField = defineField({
  type: 'text',
  max_length: 120,
});

export const bodyField = defineField({
  type: 'richtext',
  customize_toolbar: true,
  toolbar: ['bold', 'italic', 'link', 'h2', 'h3', 'list', 'olist', 'quote'],
});

export const imageField = defineField({
  type: 'asset',
  filetypes: ['images'],
});
