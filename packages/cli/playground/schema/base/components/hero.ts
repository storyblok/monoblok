import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { headlineField, imageField } from '../fields';
import { layoutFolder } from './folders/layout';

export const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  display_name: 'Hero Banner',
  color: '#1b243f',
  icon: 'block-image',
  component_group_uuid: layoutFolder.uuid,
  schema: {
    headline: defineProp(headlineField, { pos: 0, required: true }),
    subtitle: defineProp(
      defineField({ type: 'text', max_length: 200, translatable: true }),
      { pos: 1 },
    ),
    image: defineProp(imageField, { pos: 2 }),
    cta_label: defineProp(
      defineField({ type: 'text', max_length: 40 }),
      { pos: 3 },
    ),
    cta_link: defineProp(
      defineField({ type: 'multilink' }),
      { pos: 4 },
    ),
  },
});
