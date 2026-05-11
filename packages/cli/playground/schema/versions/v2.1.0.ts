import { defineBlock, defineDatasource, defineField } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';
import { wrap } from '../helpers';

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
  schema: wrap({
    title: defineField({ type: 'text', max_length: 120, required: true }),
    gallery: defineField({ type: 'multiasset', filetypes: ['images'] }),
    cta_label: defineField({ type: 'text', max_length: 40 }),
    cta_link: defineField({ type: 'multilink' }),
    lala: defineField({ type: 'multilink' }),
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
    icon: defineField({ type: 'option', source: 'internal', datasource_slug: 'themes' }),
    is_highlighted: defineField({ type: 'boolean', inline_label: true }),
    highlight_color: defineField({
      type: 'text',
      max_length: 7,
      conditional_settings: [{ field: 'is_highlighted', value: true }],
    }),
    badge: defineField({ type: 'text', max_length: 20, required: true }),
  }),
});

const ctaButtonBlock = defineBlock({
  name: 'cta_button',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: wrap({
    label: defineField({ type: 'text', max_length: 40, required: true }),
    link: defineField({ type: 'multilink' }),
    variant: defineField({
      type: 'option',
      source: 'self',
      options: [
        { _uid: 'primary', name: 'Primary', value: 'primary' },
        { _uid: 'secondary', name: 'Secondary', value: 'secondary' },
        { _uid: 'ghost', name: 'Ghost', value: 'ghost' },
      ],
      default_value: 'primary',
    }),
  }),
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: wrap({
    title: defineField({ type: 'text', max_length: 70 }),
    seo_description: defineField({ type: 'textarea', max_length: 160 }),
    body: defineField({
      type: 'bloks',
      component_whitelist: [
        heroBlock.name,
        featureCardBlock.name,
        ctaButtonBlock.name,
      ],
    }),
  }),
});

export const schema = {
  blocks: { pageBlock, heroBlock, featureCardBlock, ctaButtonBlock },
  blockFolders: { layoutFolder, contentFolder },
  datasources: { themesDatasource },
};
