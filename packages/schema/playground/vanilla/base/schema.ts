import type { Schema as InferSchema, Story as InferStory, MapiStory } from '@storyblok/schema';
import { pageBlock } from './blocks/page';
import { articleBlock } from './blocks/article';
import { heroBlock } from './blocks/hero';
import { featureCardBlock } from './blocks/feature-card';
import { kitchenSinkBlock } from './blocks/kitchen-sink';
import { emptyBlock } from './blocks/empty-block';
import { layoutFolder } from './blocks/folders/layout';
import { contentFolder } from './blocks/folders/content';
import { colorsDatasource, iconsDatasource } from './datasources';

export const contentTypes = { pageBlock, articleBlock };

export const schema = {
  blocks: { ...contentTypes, heroBlock, featureCardBlock, kitchenSinkBlock, emptyBlock },
  blockFolders: { layoutFolder, contentFolder },
  datasources: { iconsDatasource, colorsDatasource },
};

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema['blocks'];
export type Story = InferStory<Blocks>;
export type StoryMapi = MapiStory<Blocks>;
