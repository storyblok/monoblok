import { randomUUID } from 'node:crypto';
import { vol } from 'memfs';
import { getID } from '../../__tests__/helpers';

/**
 * MockStory interface - unified interface for story mocking in tests.
 * Supports both Storyblok UUIDs and third-party CMS IDs.
 */
export interface MockStory {
  id: number | string;
  uuid: string;
  name: string;
  slug: string;
  full_slug: string;
  content: Record<string, unknown>;
  is_folder: boolean;
  parent_id: null | number | string;
  published?: 0 | 1;
}

/**
 * Creates a mock story with default values.
 * Uses the global getID for unique IDs.
 */
export const makeMockStory = (overrides: Partial<MockStory> = {}): MockStory => {
  const storyId = overrides.id ?? getID();
  const slug = overrides.slug || `story-${storyId}`;
  return {
    id: storyId,
    uuid: overrides.uuid ?? randomUUID(),
    name: overrides.name || 'Story',
    slug,
    full_slug: overrides.full_slug || slug,
    content: overrides.content ?? {
      _uid: randomUUID(),
      component: 'page',
      references: [],
    },
    is_folder: overrides.is_folder ?? false,
    parent_id: overrides.parent_id ?? null,
    ...overrides,
  };
};

/**
 * Checks if a story file exists in the virtual file system.
 */
export const storyFileExists = ({ slug, uuid }: { slug: string; uuid: string }) => {
  const file = Object.entries(vol.toJSON())
    .find(([filename]) => filename.endsWith(`${slug}_${uuid}.json`))?.[1];
  return file ? JSON.parse(file).uuid === uuid : false;
};

/**
 * Generates a random third-party CMS ID for testing migrations.
 */
export const randomThirdPartyID = () => {
  return `${randomUUID().substring(0, 10)}-${Math.floor(Math.random() * 9000) + 1000}`;
};
