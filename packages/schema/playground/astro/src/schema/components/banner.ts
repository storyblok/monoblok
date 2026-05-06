import { defineBlock, defineField } from '@storyblok/schema';

import { headlineField } from '../fields';
import { layoutFolder } from './folders/layout';

export const bannerBlock = defineBlock({
  name: 'banner',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: [
    { ...headlineField, required: true },
    defineField('subline', { type: 'textarea', max_length: 250 }),
    defineField('theme', {
      type: 'option',
      source: 'internal',
      datasource_slug: 'banner_themes',
      default_value: 'light',
    }),
    defineField('show_cta', { type: 'boolean', inline_label: true }),
    defineField('cta_label', {
      type: 'text',
      max_length: 40,
      conditional_settings: [{ field: 'show_cta', value: true }],
    }),
    defineField('cta_link', {
      type: 'multilink',
      conditional_settings: [{ field: 'show_cta', value: true }],
    }),
    defineField('background_image', { type: 'asset', filetypes: ['images'] }),
  ],
});
