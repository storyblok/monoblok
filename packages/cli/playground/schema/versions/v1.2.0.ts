import { defineBlock, defineField, defineProp, defineDatasource } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';

const layoutFolder = defineBlockFolder({ name: 'Layout' });
const contentFolder = defineBlockFolder({ name: 'Content' });

const themesDatasource = defineDatasource({
  name: 'Themes',
  slug: 'themes',
  dimensions: [
    { name: 'Light', entry_value: 'light' },
    { name: 'Dark', entry_value: 'dark' },
  ],
});

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
    icon: defineProp(
      defineField({ type: 'option', source: 'internal', datasource_slug: 'themes' }),
      { pos: 3 },
    ),
    is_highlighted: defineProp(
      defineField({ type: 'boolean', inline_label: true }),
      { pos: 4 },
    ),
    highlight_color: defineProp(
      defineField({
        type: 'text',
        max_length: 7,
        conditional_settings: [{ field: 'is_highlighted', value: true }],
      }),
      { pos: 5 },
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
    company: defineProp(
      defineField({ type: 'text', max_length: 100 }),
      { pos: 3 },
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
    seo_description: defineProp(
      defineField({ type: 'textarea', max_length: 160 }),
      { pos: 1 },
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
      { pos: 2 },
    ),
  },
});

export const schema = {
  blocks: { pageBlock, heroBlock, featureCardBlock, testimonialBlock },
  blockFolders: { layoutFolder, contentFolder },
  datasources: { themesDatasource },
};
