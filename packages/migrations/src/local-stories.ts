import type { Story } from '@storyblok/management-api-client/resources/stories';

import { readLocalJsonFiles, writeLocalJsonFile } from './local-utils';

function getStoryFilename(story: Pick<Story, 'slug' | 'uuid'>): string {
  return `${story.slug}_${story.uuid}.json`;
}

export async function getLocalStories(dir: string): Promise<Story[]> {
  return readLocalJsonFiles<Story>(dir);
}

export async function updateLocalStory(
  dir: string,
  story: Story,
): Promise<void> {
  await writeLocalJsonFile(dir, getStoryFilename(story), story);
}
