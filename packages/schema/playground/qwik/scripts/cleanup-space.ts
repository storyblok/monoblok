/**
 * Deletes all stories, assets, and datasources from the configured space.
 *
 * Usage: pnpm seed:cleanup
 *
 * Run this before `pnpm seed` to re-seed an existing space from scratch.
 */
import 'dotenv/config';

import { createManagementApiClient } from '@storyblok/management-api-client';

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
});

async function deleteStories() {
  const { data } = await client.stories.list({ query: { per_page: 100 } });
  const stories = data?.stories ?? [];
  if (stories.length === 0) {
    return;
  }

  console.info(`Deleting ${stories.length} story/stories...`);
  for (const story of stories) {
    if (story.id) {
      await client.stories.delete(story.id);
      console.info(`  Deleted: ${story.full_slug}`);
    }
  }
}

async function deleteAssets() {
  const { data } = await client.assets.list({ query: { per_page: 100 } });
  const assets = data?.assets ?? [];
  if (assets.length === 0) {
    return;
  }

  console.info(`Deleting ${assets.length} asset(s)...`);
  const ids = assets.map(a => a.id).filter((id): id is number => id !== undefined);
  if (ids.length > 0) {
    await client.assets.deleteMany({ body: { ids } });
    console.info(`  Deleted ${ids.length} asset(s).`);
  }
}

async function deleteDatasources() {
  const { data } = await client.datasources.list({ query: { per_page: 100 } });
  const datasources = data?.datasources ?? [];
  if (datasources.length === 0) {
    return;
  }

  console.info(`Deleting ${datasources.length} datasource(s)...`);
  for (const ds of datasources) {
    if (ds.id) {
      await client.datasources.delete(ds.id);
      console.info(`  Deleted: ${ds.slug}`);
    }
  }
}

async function main() {
  try {
    await deleteAssets();
    await deleteStories();
    await deleteDatasources();
    console.info('Cleanup complete.');
  }
  catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

main();
