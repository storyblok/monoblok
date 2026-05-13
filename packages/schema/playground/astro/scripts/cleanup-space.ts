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

const PER_PAGE = 100;

async function fetchAllPages<T, R>(
  fetchPage: (page: number) => Promise<{ data: T; response: Response }>,
  extract: (data: T) => R[],
): Promise<R[]> {
  const items: R[] = [];
  let page = 1;
  while (true) {
    const { data, response } = await fetchPage(page);
    const pageItems = extract(data);
    items.push(...pageItems);
    const totalHeader = response.headers.get('total');
    if (!totalHeader) {
      return items;
    }
    const total = Number(totalHeader);
    if (Number.isNaN(total) || items.length >= total || pageItems.length === 0) {
      return items;
    }
    page++;
  }
}

async function listStories() {
  return fetchAllPages(
    page => client.stories.list({ query: { page, per_page: PER_PAGE } }),
    data => data?.stories ?? [],
  );
}

async function listAssets() {
  return fetchAllPages(
    page => client.assets.list({ query: { page, per_page: PER_PAGE } }),
    data => data?.assets ?? [],
  );
}

async function listDatasources() {
  return fetchAllPages(
    page => client.datasources.list({ query: { page, per_page: PER_PAGE } }),
    data => data?.datasources ?? [],
  );
}

async function listComponents() {
  const { data } = await client.components.list();
  return data?.components ?? [];
}

async function deleteStories(stories: Awaited<ReturnType<typeof listStories>>) {
  if (stories.length === 0) {
    return;
  }

  console.info(`Deleting ${stories.length} story/stories...`);
  // Deepest paths first so a folder's children are gone before the folder is
  // deleted; otherwise the cascade-delete leaves orphan ids that 404.
  const ordered = [...stories].sort(
    (a, b) => (b.full_slug?.split('/').length ?? 0) - (a.full_slug?.split('/').length ?? 0),
  );
  for (const story of ordered) {
    if (story.id) {
      await client.stories.delete(story.id);
      console.info(`  Deleted: ${story.full_slug}`);
    }
  }
}

async function deleteAssets(assets: Awaited<ReturnType<typeof listAssets>>) {
  if (assets.length === 0) {
    return;
  }

  console.info(`Deleting ${assets.length} asset(s)...`);
  const ids = assets.map(a => a.id).filter((id): id is number => id !== undefined);
  // MAPI deleteMany rejects payloads above 100 ids, so chunk the call.
  for (let i = 0; i < ids.length; i += PER_PAGE) {
    const chunk = ids.slice(i, i + PER_PAGE);
    await client.assets.deleteMany({ body: { ids: chunk } });
    console.info(`  Deleted ${chunk.length} asset(s).`);
  }
}

async function deleteDatasources(datasources: Awaited<ReturnType<typeof listDatasources>>) {
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

async function deleteComponents(components: Awaited<ReturnType<typeof listComponents>>) {
  const toDelete = components.filter(c => !c.name?.toLowerCase().endsWith('page'));
  if (toDelete.length === 0) {
    return;
  }

  console.info(`Deleting ${toDelete.length} component(s) (skipping page components)...`);
  for (const component of toDelete) {
    if (component.id) {
      await client.components.delete(component.id);
      console.info(`  Deleted: ${component.name}`);
    }
  }
}

async function main() {
  try {
    const [assets, stories, datasources, components] = await Promise.all([
      listAssets(),
      listStories(),
      listDatasources(),
      listComponents(),
    ]);
    await deleteAssets(assets);
    await deleteStories(stories);
    await deleteDatasources(datasources);
    await deleteComponents(components);
    console.info('Cleanup complete.');
  }
  catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

main();
