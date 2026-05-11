import { defineBlock, defineField } from '@storyblok/schema';
import { headlineField, imageField, richtextField } from './fields';
import { ctaFields } from './field-groups';
import { wrap } from '../helpers';

export function createSectionBlock(config: {
  name: string;
  folderUuid?: string;
  withCta?: boolean;
  withImage?: boolean;
  displayName?: string;
}) {
  return defineBlock({
    name: config.name,
    is_nestable: true,
    ...(config.displayName && { display_name: config.displayName }),
    ...(config.folderUuid && { component_group_uuid: config.folderUuid }),
    schema: wrap({
      headline: { ...headlineField, required: true as const },
      body: richtextField,
      ...(config.withImage ? { image: imageField } : {}),
      ...(config.withCta ? ctaFields() : {}),
    }),
  });
}

export function createCardBlock(config: {
  name: string;
  folderUuid?: string;
  extraFields?: Record<string, unknown>;
}) {
  return defineBlock({
    name: config.name,
    is_nestable: true,
    preview_field: 'title',
    ...(config.folderUuid && { component_group_uuid: config.folderUuid }),
    schema: wrap({
      title: defineField({ type: 'text', max_length: 80, required: true }),
      description: defineField({ type: 'textarea', max_length: 300 }),
      image: imageField,
      link: defineField({ type: 'multilink' }),
      ...(config.extraFields ?? {}),
    } as Record<string, any>),
  });
}
