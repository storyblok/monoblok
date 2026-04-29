import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { headlineField } from '../fields';
import { layoutFolder } from './folders/layout';

export const bannerBlock = defineBlock({
  name: 'banner',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: {
    headline: defineProp(headlineField, { pos: 0, required: true }),
    subline: defineProp(
      defineField({ type: 'textarea', max_length: 250 }),
      { pos: 1 },
    ),
    theme: defineProp(
      defineField({
        type: 'option',
        source: 'internal',
        datasource_slug: 'banner_themes',
        default_value: 'light',
      }),
      { pos: 2 },
    ),
    show_cta: defineProp(
      defineField({ type: 'boolean', inline_label: true }),
      { pos: 3 },
    ),
    cta_label: defineProp(
      defineField({
        type: 'text',
        max_length: 40,
        conditional_settings: [{ field: 'show_cta', value: true }],
      }),
      { pos: 4 },
    ),
    cta_link: defineProp(
      defineField({
        type: 'multilink',
        conditional_settings: [{ field: 'show_cta', value: true }],
      }),
      { pos: 5 },
    ),
    background_image: defineProp(
      defineField({ type: 'asset', filetypes: ['images'] }),
      { pos: 6 },
    ),
  },
});
