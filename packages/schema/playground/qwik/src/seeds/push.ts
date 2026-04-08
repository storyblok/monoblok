/**
 * Pushes seed stories to Storyblok via the Management API.
 *
 * Usage: pnpm push:seeds
 *
 * Run AFTER pnpm push:schema to ensure components exist.
 * This script creates example stories demonstrating the schema.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createManagementApiClient } from '@storyblok/management-api-client';
import type { StoryblokTypes } from '../schema/types';
import { createHomeStory } from './stories/home';
import { createAboutStory } from './stories/about';

const __dirname = dirname(fileURLToPath(import.meta.url));

const token = process.env.STORYBLOK_TOKEN;
const spaceId = process.env.STORYBLOK_SPACE_ID;

if (!token || !spaceId) {
  console.error('Missing required env vars: STORYBLOK_TOKEN, STORYBLOK_SPACE_ID');
  process.exit(1);
}

const client = createManagementApiClient({
  personalAccessToken: token,
  spaceId: Number(spaceId),
  throwOnError: true,
}).withTypes<StoryblokTypes>();

async function uploadAssets() {
  const mediaImagePath = resolve(__dirname, 'assets/media-image.png');
  const mediaImageBuffer = readFileSync(mediaImagePath);

  console.info('Uploading assets...');
  const mediaAsset = await client.assets.create({
    body: {
      short_filename: 'media-image.png',
      alt: 'About image',
      title: 'About Image',
    },
    file: new Blob([mediaImageBuffer], { type: 'image/png' }),
  });
  console.info('  Uploaded: media-image.png');

  return { mediaAsset };
}

async function deleteExistingAssets() {
  const { data } = await client.assets.list({ query: { per_page: 100 } });
  const existing = data?.assets ?? [];
  if (existing.length === 0) {
    return;
  }

  console.info(`Deleting ${existing.length} existing asset(s)...`);
  const ids = existing.map(a => a.id).filter((id): id is number => id !== undefined);
  if (ids.length > 0) {
    await client.assets.deleteMany({ body: { ids } });
    console.info(`  Deleted ${ids.length} asset(s).`);
  }
}

async function deleteExistingStories() {
  const { data } = await client.stories.list({ query: { per_page: 100 } });
  const existing = data?.stories ?? [];
  if (existing.length === 0) {
    return;
  }

  console.info(`Deleting ${existing.length} existing story/stories...`);
  for (const story of existing) {
    if (story.id) {
      await client.stories.delete(story.id);
      console.info(`  Deleted: ${story.full_slug}`);
    }
  }
}

async function pushStories(stories: (ReturnType<typeof createHomeStory> | ReturnType<typeof createAboutStory>)[]) {
  console.info(`Pushing ${stories.length} story/stories...`);
  for (const story of stories) {
    await client.stories.create({
      body: {
        story,
        publish: 1,
      },
    });
    console.info(`  Pushed: /${story.slug}`);
  }
}

async function main() {
  try {
    await deleteExistingAssets();
    await deleteExistingStories();
    const { mediaAsset } = await uploadAssets();
    const stories = [createHomeStory(mediaAsset), createAboutStory(mediaAsset)];
    await pushStories(stories);
    console.info('Done.');
  }
  catch (err) {
    console.error('Error pushing seeds:', err);
    process.exit(1);
  }
}

main();
