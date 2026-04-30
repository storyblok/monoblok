import { defineBlock, defineField, defineProp, defineDatasource } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';

const layoutFolder = defineBlockFolder({ name: 'Layout' });
const contentFolder = defineBlockFolder({ name: 'Content' });
const themesDatasource = defineDatasource({ name: 'Themes', slug: 'themes' });

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: {
    headline: defineProp(
      defineField({ type: 'text', max_length: 120 }),
      { pos: 0, required: true },
    ),
    subtitle: defineProp(
      defineField({ type: 'text', max_length: 200, translatable: true }),
      { pos: 1 },
    ),
    image: defineProp(
      defineField({ type: 'asset', filetypes: ['images'] }),
      { pos: 2 },
    ),
    cta_link: defineProp(
      defineField({ type: 'multilink' }),
      { pos: 3 },
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

const testimonialBlock = defineBlock({
  name: 'testimonial',
  is_nestable: true,
  component_group_uuid: contentFolder.uuid,
  schema: {
    quote: defineProp(
      defineField({ type: 'textarea', max_length: 500 }),
      { pos: 0, required: true },
    ),
    author: defineProp(
      defineField({ type: 'text', max_length: 100 }),
      { pos: 1, required: true },
    ),
    avatar: defineProp(
      defineField({ type: 'asset', filetypes: ['images'] }),
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
        component_whitelist: [
          heroBlock.name,
          featureCardBlock.name,
          testimonialBlock.name,
        ],
      }),
      { pos: 1 },
    ),
  },
});

export const schema = {
  blocks: { pageBlock, heroBlock, featureCardBlock, testimonialBlock },
  blockFolders: { layoutFolder, contentFolder },
  datasources: { themesDatasource },
};
