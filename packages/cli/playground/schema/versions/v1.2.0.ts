import { defineBlock, defineField, defineDatasource } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';
import { wrap } from '../helpers';

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
  schema: wrap({
    headline: defineField({ type: 'text', max_length: 120, required: true }),
    subtitle: defineField({ type: 'text', max_length: 200, translatable: true }),
    image: defineField({ type: 'asset', filetypes: ['images'] }),
    cta_label: defineField({ type: 'text', max_length: 40 }),
    cta_link: defineField({ type: 'multilink' }),
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
  }),
});

const testimonialBlock = defineBlock({
  name: 'testimonial',
  is_nestable: true,
  component_group_uuid: contentFolder.uuid,
  schema: wrap({
    quote: defineField({ type: 'textarea', max_length: 500, required: true }),
    author: defineField({ type: 'text', max_length: 100, required: true }),
    avatar: defineField({ type: 'asset', filetypes: ['images'] }),
    company: defineField({ type: 'text', max_length: 100 }),
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
        testimonialBlock.name,
      ],
    }),
  }),
});

export const schema = {
  blocks: { pageBlock, heroBlock, featureCardBlock, testimonialBlock },
  blockFolders: { layoutFolder, contentFolder },
  datasources: { themesDatasource },
};
