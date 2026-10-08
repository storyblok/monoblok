import { getStoryFilename } from "@storyblok/utils/local-files";

import type { Story } from "./types";

import { readLocalJsonFiles, writeLocalJsonFile } from "./local-utils";

export async function getLocalStories(dir: string): Promise<Story[]> {
  return readLocalJsonFiles<Story>(dir);
}

export async function updateLocalStory(dir: string, story: Story): Promise<void> {
  await writeLocalJsonFile(dir, getStoryFilename(story), story);
}
