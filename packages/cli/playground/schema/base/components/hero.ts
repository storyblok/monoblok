import { defineBlock, defineField } from '@storyblok/schema';
import { headlineField, imageField } from '../fields';
import { layoutFolder } from './folders/layout';
import { wrap } from '../../helpers';

export const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  display_name: 'Hero Banner',
  color: '#1b243f',
  icon: 'block-sadfadsfads',
  component_group_uuid: layoutFolder.uuid,
  
  schema: wrap({
    headline: { ...headlineField, required: true },
    subtitle: defineField({ type: 'richtext', max_length: 200, translatable: true }),
    image: imageField,
    cta_label: defineField({ type: 'text', max_length: 40 }),
    cta_link: defineField({ type: 'multilink' }),
  }),
});
