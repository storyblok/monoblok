import type { Schema as InferSchema, Story as InferStory } from '@storyblok/schema';
import type { Story as InferStoryMapi } from '@storyblok/schema/mapi';
import { pageBlock } from './components/page';
import { heroBlock } from './components/hero';
import { featureCardBlock } from './components/feature-card';
import { kitchenSinkBlock } from './components/kitchen-sink';
import { emptyBlock } from './components/empty-block';
import { layoutFolder } from './components/folders/layout';
import { contentFolder } from './components/folders/content';
import { colorsDatasource, iconsDatasource } from './datasources';

export const schema = {
  blocks: { pageBlock, heroBlock, featureCardBlock, kitchenSinkBlock, emptyBlock },
  blockFolders: { layoutFolder, contentFolder },
  datasources: { iconsDatasource, colorsDatasource },
};

export default () => {
  console.log('should be ignored');
};

export const shouldBeIgnored = 42;

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema['blocks'];
export type Story = InferStory<Blocks>;
export type StoryMapi = InferStoryMapi<Blocks>;
