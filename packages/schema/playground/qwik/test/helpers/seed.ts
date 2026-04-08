import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createManagementApiClient } from '@storyblok/management-api-client';
import type { Asset, BlokContentInput } from '@storyblok/management-api-client';
import { pageBlock } from '../../src/schema/components/page';
import { heroBlock } from '../../src/schema/components/hero';
import { introBlock } from '../../src/schema/components/intro';
import { mediaBlock } from '../../src/schema/components/media';
import { teaserListBlock } from '../../src/schema/components/teaser-list';
import { teaserBlock } from '../../src/schema/components/teaser';
import type { TestSpaceConfig } from './get-test-space-config';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MEDIA_IMAGE_PATH = resolve(__dirname, '../../src/seeds/assets/media-image.png');

const components = [
  pageBlock,
  heroBlock,
  introBlock,
  mediaBlock,
  teaserListBlock,
  teaserBlock,
];

export interface ScenarioAssets {
  mediaImage: Asset;
}

interface StoryCreatePayload {
  name: string;
  slug: string;
  content: BlokContentInput;
}

export interface Scenario {
  stories: (assets: ScenarioAssets) => StoryCreatePayload[];
  /** Set to true if the scenario requires assets to be uploaded */
  needsAssets?: boolean;
}

export async function seedScenario(config: TestSpaceConfig, scenario: Scenario): Promise<void> {
  const client = createManagementApiClient({
    personalAccessToken: config.mapiToken,
    spaceId: config.spaceId,
    throwOnError: true,
  });

  // 1. Delete all existing stories
  const { data: storiesData } = await client.stories.list({ query: { per_page: 100 } });
  const existingStories = storiesData?.stories ?? [];
  for (const story of existingStories) {
    if (story.id) {
      await client.stories.delete(story.id);
    }
  }

  // 2. Delete all existing assets
  const { data: assetsData } = await client.assets.list({ query: { per_page: 100 } });
  const existingAssets = assetsData?.assets ?? [];
  if (existingAssets.length > 0) {
    const ids = existingAssets.map(a => a.id).filter((id): id is number => id !== undefined);
    if (ids.length > 0) {
      await client.assets.deleteMany({ body: { ids } });
    }
  }

  // 3. Delete all existing components (clean slate)
  const { data: componentsData } = await client.components.list();
  const existingComponents = componentsData?.components ?? [];
  for (const comp of existingComponents) {
    if (comp.id) {
      try {
        await client.components.delete(comp.id);
      }
      catch {
        // Skip protected components
      }
    }
  }

  // 4. Push component definitions (upsert: update if survived deletion, create otherwise)
  const { data: afterDeleteData } = await client.components.list();
  const survivingByName = new Map((afterDeleteData?.components ?? []).map(c => [c.name, c]));

  for (const comp of components) {
    const payload = {
      name: comp.name,
      display_name: comp.display_name,
      schema: comp.schema,
      is_root: comp.is_root,
      is_nestable: comp.is_nestable,
    };
    const existing = survivingByName.get(comp.name);
    if (existing?.id) {
      await client.components.update(existing.id, { body: { component: payload } });
    }
    else {
      await client.components.create({ body: { component: payload } });
    }
  }

  // 5. Upload assets if the scenario requires them
  let assets: ScenarioAssets | undefined;
  if (scenario.needsAssets) {
    const mediaImageBuffer = readFileSync(MEDIA_IMAGE_PATH);
    const mediaImage = await client.assets.create({
      body: {
        short_filename: 'media-image.png',
        alt: 'Test media image',
        title: 'Test Media Image',
      },
      file: new Blob([mediaImageBuffer], { type: 'image/png' }),
    });
    assets = { mediaImage };
  }

  // Provide a stub for scenarios that don't upload assets
  const scenarioAssets: ScenarioAssets = assets ?? {
    // TODO
    mediaImage: {} as Asset,
  };

  // 6. Create + publish stories from the scenario
  for (const story of scenario.stories(scenarioAssets)) {
    await client.stories.create({
      body: {
        story: {
          name: story.name,
          slug: story.slug,
          content: story.content,
        },
        publish: 1,
      },
    });
  }
}
