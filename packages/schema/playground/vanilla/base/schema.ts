import { defineSchema } from '@storyblok/schema';
import type { Schema as InferSchema, Story as InferStory, MapiStory } from '@storyblok/schema';
import { storyblokColorField } from '@storyblok/schema/field-plugins';
import { pageBlock } from './blocks/page';
import { articleBlock } from './blocks/article';
import { heroBlock } from './blocks/hero';
import { featureCardBlock } from './blocks/feature-card';
import { kitchenSinkBlock } from './blocks/kitchen-sink';
import { emptyBlock } from './blocks/empty-block';
import { blogTagsDatasource, colorsDatasource, iconsDatasource } from './datasources';

export const contentTypes = { pageBlock, articleBlock };

export const schema = defineSchema({
  blocks: { ...contentTypes, heroBlock, featureCardBlock, kitchenSinkBlock, emptyBlock },
  datasources: { iconsDatasource, colorsDatasource, blogTagsDatasource },
  // Register the official Colorpicker plugin so `custom` fields with
  // `field_type: 'storyblok-colorpicker'` are typed and runtime-validated.
  fieldPlugins: { storyblokColorField },
});

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema['blocks'];
export type FieldPlugins = Schema['fieldPlugins'];
export type Story = InferStory<Blocks, FieldPlugins>;
export type StoryMapi = MapiStory<Blocks, FieldPlugins>;
