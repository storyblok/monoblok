import { defineBlock, defineDatasource, defineField, defineProp } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';

const layoutFolder = defineBlockFolder({ name: 'Layout' });
const contentFolder = defineBlockFolder({ name: 'Content' });

const themesDatasource = defineDatasource({
  name: 'Themes',
  slug: 'themes',
  dimensions: [
    { name: 'Light', entry_value: 'light' },
    { name: 'High Contrast', entry_value: 'high-contrast' },
  ],
});

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: {
    title: defineProp(
      defineField({ type: 'text', max_length: 120 }),
      { pos: 0, required: true },
    ),
    gallery: defineProp(
      defineField({ type: 'multiasset', filetypes: ['images'] }),
      { pos: 1 },
    ),
    cta_label: defineProp(
      defineField({ type: 'text', max_length: 40 }),
      { pos: 2 },
    ),
    cta_link: defineProp(
      defineField({ type: 'multilink' }),
      { pos: 3 },
    ),
    lala: defineProp(
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
    badge: defineProp(
      defineField({ type: 'text', max_length: 20 }),
      { pos: 6, required: true },
    ),
  },
});

const ctaButtonBlock = defineBlock({
  name: 'cta_button',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: {
    label: defineProp(
      defineField({ type: 'text', max_length: 40 }),
      { pos: 0, required: true },
    ),
    link: defineProp(
      defineField({ type: 'multilink' }),
      { pos: 1 },
    ),
    variant: defineProp(
      defineField({
        type: 'option',
        source: 'self',
        options: [
          { _uid: 'primary', name: 'Primary', value: 'primary' },
          { _uid: 'secondary', name: 'Secondary', value: 'secondary' },
          { _uid: 'ghost', name: 'Ghost', value: 'ghost' },
        ],
        default_value: 'primary',
      }),
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
          ctaButtonBlock.name,
        ],
      }),
      { pos: 2 },
    ),
  },
});

export const schema = {
  blocks: { pageBlock, heroBlock, featureCardBlock, ctaButtonBlock },
  blockFolders: { layoutFolder, contentFolder },
  datasources: { themesDatasource },
};
