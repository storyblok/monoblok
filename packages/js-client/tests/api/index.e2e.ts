import StoryblokClient from 'storyblok-js-client';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * Smoke tests against the real Storyblok CDN API.
 *
 * These tests are intentionally minimal — they exist to catch real API
 * regressions (e.g. auth, response shape changes, content structure) that
 * MSW-based tests cannot detect.
 *
 * They are skipped automatically when VITE_ACCESS_TOKEN is not set, so
 * they never block CI for external contributors. They run when a valid
 * token is available (e.g. internal PRs or scheduled workflows).
 *
 * Required env vars (in .env.test):
 *   VITE_ACCESS_TOKEN  — CDN access token
 *   VITE_SPACE_ID      — numeric space ID
 */
describe.skipIf(!process.env.VITE_ACCESS_TOKEN)('StoryblokClient (smoke tests)', () => {
  let client: StoryblokClient;

  beforeEach(() => {
    client = new StoryblokClient({
      accessToken: process.env.VITE_ACCESS_TOKEN,
      cache: { type: 'memory', clear: 'auto' },
    });
  });

  it('authenticates and returns space information', async () => {
    const { data } = await client.get('cdn/spaces/me');
    expect(data.space.id).toBe(Number(process.env.VITE_SPACE_ID));
  });

  it('returns at least one published story', async () => {
    const { data } = await client.get('cdn/stories');
    expect(data.stories.length).toBeGreaterThan(0);
  });

  it('returns a specific story by slug', async () => {
    const { data } = await client.get('cdn/stories/testcontent-0');
    expect(data.story.slug).toBe('testcontent-0');
  });

  it('resolves relations against real content', async () => {
    const { data } = await client.get('cdn/stories/testcontent-0', {
      resolve_relations: 'root.author',
    });
    expect(data.story.content.author[0].slug).toBe('edgar-allan-poe');
  });

  it('returns stories matching a by_slugs wildcard', async () => {
    const { data } = await client.get('cdn/stories', { by_slugs: 'folder/*' });
    expect(data.stories.length).toBeGreaterThan(0);
  });

  it('paginates through all stories with getAll', async () => {
    const result = await client.getAll('cdn/stories', {});
    expect(result.length).toBeGreaterThan(0);
  });
});
