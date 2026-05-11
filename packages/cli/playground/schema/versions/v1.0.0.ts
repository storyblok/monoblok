import { defineBlock, defineField } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';
import { wrap } from '../helpers';

const layoutFolder = defineBlockFolder({ name: 'Layout' });

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: wrap({
    headline: defineField({ type: 'text', max_length: 120, required: true }),
    image: defineField({ type: 'asset', filetypes: ['images'] }),
  }),
});

const featureCardBlock = defineBlock({
  name: 'feature_card',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: wrap({
    title: defineField({ type: 'text', max_length: 80, required: true }),
    description: defineField({ type: 'textarea', max_length: 300 }),
    link: defineField({ type: 'multilink' }),
  }),
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: wrap({
    title: defineField({
      type: 'richtext',
      customize_toolbar: true,
      toolbar: ['ai-simplify', 'wrong-value'],
    }),
    body: defineField({
      type: 'bloks',
      component_whitelist: [heroBlock.name, featureCardBlock.name],
    }),
  }),
});

export const schema = {
  blocks: { pageBlock, heroBlock, featureCardBlock },
  blockFolders: { layoutFolder },
};
