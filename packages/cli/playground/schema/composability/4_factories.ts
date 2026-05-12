import { defineBlock, defineField } from '@storyblok/schema';
import { bodyField, headlineField, imageField } from './1_fields';
import { ctaFields } from './2_field-groups';
import type { Field } from '@storyblok/schema';

type NamedField = Field & { name: string };

export function createSectionBlock(config: {
  name: string;
  folderUuid?: string;
  displayName?: string;
  withCta?: boolean;
  withImage?: boolean;
}) {
  return defineBlock({
    name: config.name,
    is_nestable: true,
    ...(config.displayName && { display_name: config.displayName }),
    ...(config.folderUuid && { component_group_uuid: config.folderUuid }),
    schema: [
      { ...headlineField, required: true },
      bodyField,
      ...(config.withImage ? [imageField] : []),
      ...(config.withCta ? ctaFields() : []),
    ],
  });
}

export function createCardBlock(config: {
  name: string;
  folderUuid?: string;
  extraFields?: readonly NamedField[];
}) {
  return defineBlock({
    name: config.name,
    is_nestable: true,
    preview_field: 'title',
    ...(config.folderUuid && { component_group_uuid: config.folderUuid }),
    schema: [
      defineField('title', { type: 'text', max_length: 80, required: true }),
      defineField('description', { type: 'textarea', max_length: 300 }),
      imageField,
      defineField('link', { type: 'multilink' }),
      ...(config.extraFields ?? []),
    ],
  });
}
