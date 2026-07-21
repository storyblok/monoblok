import { defineBlock, defineField } from '@storyblok/schema';
import { bodyField, headlineField, imageField } from './1_fields';
import { ctaFields } from './2_field-groups';
import type { Field } from '@storyblok/schema';

type NamedField = Field & { name: string };

export function createSectionBlock(config: {
  name: string;
  displayName?: string;
  withCta?: boolean;
  withImage?: boolean;
}) {
  return defineBlock({
    name: config.name,
    is_nestable: true,
    ...(config.displayName && { display_name: config.displayName }),
    fields: [
      { ...headlineField, required: true },
      bodyField,
      ...(config.withImage ? [imageField] : []),
      ...(config.withCta ? ctaFields() : []),
    ],
  });
}

export function createCardBlock(config: {
  name: string;
  extraFields?: readonly NamedField[];
}) {
  return defineBlock({
    name: config.name,
    is_nestable: true,
    preview_field: 'title',
    fields: [
      defineField('title', { type: 'text', max_length: 80, required: true }),
      defineField('description', { type: 'textarea', max_length: 300 }),
      imageField,
      defineField('link', { type: 'multilink' }),
      ...(config.extraFields ?? []),
    ],
  });
}
