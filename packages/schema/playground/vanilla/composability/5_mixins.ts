import { defineField } from '@storyblok/schema';
import type { Field } from '@storyblok/schema';

type NamedField = Field & { name: string };

/** Appends a `tracking_id` field to any fields array. */
export function withTracking<const T extends readonly NamedField[]>(fields: T) {
  return [
    ...fields,
    defineField('tracking_id', {
      type: 'text',
      max_length: 50,
      description: 'Analytics tracking identifier',
    }),
  ];
}

/** Prepends a collapsible `section` grouping field to any fields array. */
export function withSection<const T extends readonly NamedField[]>(
  fields: T,
  config: { title: string; keys: string[] },
) {
  return [
    defineField('section', {
      type: 'section',
      keys: config.keys,
      fieldset: { title: config.title, collapsible: true, collapsed: false },
    }),
    ...fields,
  ];
}
