import { defineField } from '@storyblok/schema';

export const headlineField = defineField({
  type: 'text',
  max_length: 120,
});

export const subtitleField = defineField({
  type: 'text',
  max_length: 200,
  translatable: true,
});

export const imageField = defineField({
  type: 'asset',
  filetypes: ['images'],
});

export const richtextField = defineField({
  type: 'richtext',
  customize_toolbar: true,
  toolbar: ['bold', 'italic', 'link', 'h2', 'h3', 'list', 'olist', 'quote'],
});

export const themeOptionField = defineField({
  type: 'option',
  source: 'internal',
  datasource_slug: 'themes',
});
