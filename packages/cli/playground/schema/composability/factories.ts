import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { headlineField, imageField, richtextField } from './fields';
import { ctaFields } from './field-groups';

export function createSectionBlock(config: {
  name: string;
  folderUuid?: string;
  withCta?: boolean;
  withImage?: boolean;
  displayName?: string;
}) {
  let pos = 0;

  const schema: Record<string, unknown> = {
    headline: defineProp(headlineField, { pos: pos++, required: true }),
    body: defineProp(richtextField, { pos: pos++ }),
  };

  if (config.withImage) {
    schema.image = defineProp(imageField, { pos: pos++ });
  }
  if (config.withCta) {
    Object.assign(schema, ctaFields(pos));
    pos += 2;
  }

  return defineBlock({
    name: config.name,
    is_nestable: true,
    ...(config.displayName && { display_name: config.displayName }),
    ...(config.folderUuid && { component_group_uuid: config.folderUuid }),
    schema,
  });
}

export function createCardBlock(config: {
  name: string;
  folderUuid?: string;
  extraFields?: Record<string, unknown>;
}) {
  let pos = 0;

  const schema: Record<string, unknown> = {
    title: defineProp(
      defineField({ type: 'text', max_length: 80 }),
      { pos: pos++, required: true },
    ),
    description: defineProp(
      defineField({ type: 'textarea', max_length: 300 }),
      { pos: pos++ },
    ),
    image: defineProp(imageField, { pos: pos++ }),
    link: defineProp(
      defineField({ type: 'multilink' }),
      { pos: pos++ },
    ),
  };

  if (config.extraFields) {
    for (const [key, field] of Object.entries(config.extraFields)) {
      schema[key] = defineProp(field as any, { pos: pos++ });
    }
  }

  return defineBlock({
    name: config.name,
    is_nestable: true,
    preview_field: 'title',
    ...(config.folderUuid && { component_group_uuid: config.folderUuid }),
    schema,
  });
}
