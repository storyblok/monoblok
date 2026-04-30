import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';

const layoutFolder = defineBlockFolder({ name: 'Layout' });

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: {
    headline: defineProp(
      defineField({ type: 'text', max_length: 120 }),
      { pos: 0, required: true },
    ),
    image: defineProp(
      defineField({ type: 'asset', filetypes: ['images'] }),
      { pos: 1 },
    ),
  },
});

const featureCardBlock = defineBlock({
  name: 'feature_card',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: {
    title: defineProp(
      defineField({ type: 'text', max_length: 80 }),
      { pos: 0, required: true },
    ),
    description: defineProp(
      defineField({ type: 'textarea', max_length: 300 }),
      { pos: 1 },
    ),
    link: defineProp(
      defineField({ type: 'multilink' }),
      { pos: 2 },
    ),
  },
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: {
    title: defineProp(
      defineField({ type: 'text', max_length: 70 }),
      { pos: 0 },
    ),
    body: defineProp(
      defineField({
        type: 'bloks',
        component_whitelist: [heroBlock.name, featureCardBlock.name],
      }),
      { pos: 1 },
    ),
  },
});

export const schema = {
  blocks: { pageBlock, heroBlock, featureCardBlock },
  blockFolders: { layoutFolder },
};
