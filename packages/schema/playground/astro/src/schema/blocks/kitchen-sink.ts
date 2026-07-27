import { defineBlock, defineField } from '@storyblok/schema';

import { markdownField, richtextField } from '../fields';
import { teaserBlock } from './teaser';

/**
 * One field of every Storyblok field type, each named after its own type.
 *
 * This is a fixture for exercising schema type resolution end to end: the
 * matching `kitchen-sink.astro` component consumes every field the way an ideal
 * consumer should be able to, so any gap in `BlockContent` surfaces as a type
 * error there rather than staying hidden.
 *
 * Covers 15 of the 17 field types. The two layout-only types, `tab` and
 * `section`, are deliberately omitted: they group other fields in the editor and
 * carry no content value, so every field here maps to a real value in story JSON.
 */
export const kitchenSinkBlock = defineBlock({
  name: 'kitchen_sink',
  display_name: 'Kitchen Sink',
  description: 'One field of every Storyblok field type. Fixture for schema type-resolution testing.',
  is_nestable: true,
  preview_field: 'text',
  fields: [
    // The only required field, so it resolves to a bare `string` rather than
    // `string | null | undefined` like every other field here.
    defineField('text', {
      type: 'text',
      max_length: 120,
      translatable: true,
      required: true,
    }),
    defineField('textarea', { type: 'textarea', max_length: 300 }),
    // Both shared fields are named `body`, so re-stamp them with the type name.
    defineField('richtext', richtextField),
    defineField('markdown', markdownField),
    defineField('number', {
      type: 'number',
      min_value: 0,
      max_value: 10,
      steps: 1,
      decimals: 0,
      default_value: '2',
    }),
    defineField('datetime', { type: 'datetime', disable_time: false }),
    defineField('boolean', {
      type: 'boolean',
      inline_label: true,
      default_value: 'false',
    }),
    // Self-sourced: choices live on the field itself, no datasource involved.
    defineField('option', {
      type: 'option',
      options: [
        { name: 'Alpha', value: 'alpha' },
        { name: 'Beta', value: 'beta' },
        { name: 'Gamma', value: 'gamma' },
      ],
      default_value: 'alpha',
    }),
    defineField('options', {
      type: 'options',
      options: [
        { name: 'One', value: 'one' },
        { name: 'Two', value: 'two' },
        { name: 'Three', value: 'three' },
      ],
    }),
    defineField('asset', { type: 'asset', filetypes: ['images'] }),
    defineField('multiasset', {
      type: 'multiasset',
      filetypes: ['images'],
      maximum_entries: 4,
    }),
    defineField('multilink', { type: 'multilink', allow_target_blank: true }),
    defineField('table', { type: 'table' }),
    // `allow` makes the narrowing observable: the resolved array should be
    // exactly the teaser shape, not the whole registry.
    defineField('bloks', { type: 'bloks', allow: [teaserBlock.name] }),
    defineField('custom', { type: 'custom', field_type: 'storyblok-colorpicker' }),
  ],
});
