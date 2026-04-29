/**
 * Pushes all component definitions to Storyblok via the Management API.
 *
 * Usage: pnpm push:schema
 *
 * This script:
 * 1. Deletes all existing components in the space
 * 2. Pushes the components defined in this package
 */
import 'dotenv/config';

import { createManagementApiClient } from '@storyblok/management-api-client';
import { pageBlock } from './components/page';
import { heroBlock } from './components/hero';
import { introBlock } from './components/intro';
import { mediaBlock } from './components/media';
import { teaserListBlock } from './components/teaser-list';
import { teaserBlock } from './components/teaser';

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

const components = [
  pageBlock,
  heroBlock,
  introBlock,
  mediaBlock,
  teaserListBlock,
  teaserBlock,
];

async function deleteAllComponents() {
  const { data } = await client.components.list();
  const existing = data?.components ?? [];

  if (existing.length === 0) {
    console.info('No existing components to delete.');
    return;
  }

  console.info(`Deleting ${existing.length} existing component(s)...`);
  for (const comp of existing) {
    if (comp.id) {
      try {
        await client.components.delete(comp.id);
        console.info(`  Deleted: ${comp.name}`);
      }
      catch {
        console.warn(`  Skipped (protected): ${comp.name}`);
      }
    }
  }
}

async function pushComponents() {
  // Fetch remaining components (some may have survived deletion if protected)
  const { data: existing } = await client.components.list();
  const existingByName = new Map((existing?.components ?? []).map(c => [c.name, c]));

  console.info(`Pushing ${components.length} component(s)...`);
  for (const comp of components) {
    const payload = {
      name: comp.name,
      display_name: comp.display_name,
      schema: comp.schema,
      is_root: comp.is_root,
      is_nestable: comp.is_nestable,
    };

    const existing = existingByName.get(comp.name);
    if (existing?.id) {
      await client.components.update(existing.id, { body: { component: payload } });
      console.info(`  Updated: ${comp.name}`);
    }
    else {
      await client.components.create({ body: { component: payload } });
      console.info(`  Created: ${comp.name}`);
    }
  }
}

async function main() {
  try {
    await deleteAllComponents();
    await pushComponents();
    console.info('Done.');
  }
  catch (err) {
    console.error('Error pushing schema:', err);
    process.exit(1);
  }
}

main();
