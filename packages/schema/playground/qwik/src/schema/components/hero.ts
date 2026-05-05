import { defineBlock, defineField } from '@storyblok/schema';

import { eyebrowField, headlineField } from '../fields';
import { layoutFolder } from './folders/layout';

export const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: [
    eyebrowField,
    { ...headlineField, required: true },
    defineField('image', { type: 'asset', filetypes: ['images'] }),
  ],
});
