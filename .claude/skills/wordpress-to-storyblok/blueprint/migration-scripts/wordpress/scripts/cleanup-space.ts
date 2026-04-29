/**
 * Deletes all stories, assets, and datasources from the configured space.
 *
 * Usage: pnpm seed:cleanup
 *
 * Paginated to handle thousands of stories — the WordPress migration produces far
 * more entities than the per_page=100 cap of a single request.
 *
 * Deletions are intentionally awaited in sequence by entity type. Do not start
 * background cleanup work; follow-up migration pushes must not race cleanup.
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

const PER_PAGE = 100;

async function deleteStories() {
  let total = 0;
  while (true) {
    const { data } = await client.stories.list({ query: { per_page: PER_PAGE, page: 1 } });
    const stories = data?.stories ?? [];
    if (stories.length === 0) {
      break;
    }
    for (const story of stories) {
      if (story.id) {
        await client.stories.delete(story.id);
        total += 1;
      }
    }
    console.info(`  Deleted ${total} story/stories so far...`);
  }
  console.info(`Stories: deleted ${total}.`);
}

async function deleteAssets() {
  let total = 0;
  while (true) {
    const { data } = await client.assets.list({ query: { per_page: PER_PAGE, page: 1 } });
    const assets = data?.assets ?? [];
    if (assets.length === 0) {
      break;
    }
    const ids = assets.map(a => a.id).filter((id): id is number => id !== undefined);
    if (ids.length === 0) {
      break;
    }
    await client.assets.deleteMany({ body: { ids } });
    total += ids.length;
    console.info(`  Deleted ${total} asset(s) so far...`);
  }
  console.info(`Assets: deleted ${total}.`);
}

async function deleteDatasources() {
  let total = 0;
  while (true) {
    const { data } = await client.datasources.list({ query: { per_page: PER_PAGE, page: 1 } });
    const datasources = data?.datasources ?? [];
    if (datasources.length === 0) {
      break;
    }
    for (const ds of datasources) {
      if (ds.id) {
        await client.datasources.delete(ds.id);
        total += 1;
      }
    }
    console.info(`  Deleted ${total} datasource(s) so far...`);
  }
  console.info(`Datasources: deleted ${total}.`);
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
