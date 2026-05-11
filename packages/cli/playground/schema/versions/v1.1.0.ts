import { defineBlock, defineDatasource, defineField } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';
import { wrap } from '../helpers';

const layoutFolder = defineBlockFolder({ name: 'Layout' });
const contentFolder = defineBlockFolder({ name: 'Content' });
const themesDatasource = defineDatasource({ name: 'Themes', slug: 'themes' });

const heroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: wrap({
    headline: defineField({ type: 'text', max_length: 120, required: true }),
    subtitle: defineField({ type: 'text', max_length: 200, translatable: true }),
    image: defineField({ type: 'asset', filetypes: ['images'] }),
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
  }),
});

const testimonialBlock = defineBlock({
  name: 'testimonial',
  is_nestable: true,
  component_group_uuid: contentFolder.uuid,
  schema: wrap({
    quote: defineField({ type: 'textarea', max_length: 500, required: true }),
    author: defineField({ type: 'richtext', max_length: 100, required: true }),
    avatar: defineField({ type: 'asset', filetypes: ['images'] }),
  }),
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: wrap({
    title: defineField({ type: 'text', max_length: 70 }),
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
