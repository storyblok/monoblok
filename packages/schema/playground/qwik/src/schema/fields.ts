import { defineField } from '@storyblok/schema';

export const headlineField = defineField({
  type: 'text',
  max_length: 120,
});

export const eyebrowField = defineField({
  type: 'text',
  max_length: 80,
});

export const markdownField = defineField({
  type: 'markdown',
  rich_markdown: true,
  customize_toolbar: true,
  toolbar: ['bold', 'italic', 'link', 'h2', 'h3', 'list', 'olist', 'code'],
  allow_multiline: true,
});

export const richtextField = defineField({
  type: 'richtext',
  customize_toolbar: true,
  toolbar: ['bold', 'italic', 'link', 'h2', 'h3', 'list', 'olist', 'quote', 'code'],
});
