import { defineBlock, defineField, defineProp } from '@storyblok/schema';

import { eyebrowField, headlineField } from '../fields';
import { layoutFolder } from './folders/layout';

export const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: {
    eyebrow: defineProp(eyebrowField, { pos: 0 }),
    headline: defineProp(headlineField, { pos: 1, required: true }),
    image: defineProp(defineField({ type: 'asset', filetypes: ['images'] }), { pos: 2 }),
  },
});
