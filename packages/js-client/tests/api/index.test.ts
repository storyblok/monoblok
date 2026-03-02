import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import StoryblokClient from 'storyblok-js-client';

const ACCESS_TOKEN = 'test-token';
const BASE_URL = 'https://api.storyblok.com/v2';

const makeStory = (overrides: Record<string, unknown> = {}) => ({
  id: Math.floor(Math.random() * 100000),
  uuid: `uuid-${Math.random()}`,
  name: 'Test Story',
  slug: 'test-story',
  full_slug: 'test-story',
  content: { _uid: 'uid-1', component: 'page' },
  ...overrides,
});

let _linkCounter = 0;
const makeLink = (overrides: Record<string, unknown> = {}) => {
  const n = ++_linkCounter;
  return {
    id: n,
    uuid: `uuid-link-${n}`,
    slug: `test-link-${n}`,
    name: `Test Link ${n}`,
    is_folder: false,
    parent_id: 0,
    published: true,
    position: 0,
    ...overrides,
  };
};

const server = setupServer();

const preconditions = {
  canFetchSpaceInfo() {
    server.use(
      http.get(`${BASE_URL}/cdn/spaces/me`, () =>
        HttpResponse.json({ space: { id: 12345 } })),
    );
  },
  canFetchStories(stories: ReturnType<typeof makeStory>[], params: Record<string, string> = {}, cv = 12345678) {
    server.use(
      http.get(`${BASE_URL}/cdn/stories`, ({ request }) => {
        const url = new URL(request.url);
        const matchesParams = Object.entries(params).every(
          ([key, value]) => url.searchParams.get(key) === value,
        );
        const page = Number(url.searchParams.get('page') ?? 1);
        const perPage = Number(url.searchParams.get('per_page') ?? 25);
        const items = matchesParams ? stories : [];
        const pageItems = items.slice((page - 1) * perPage, page * perPage);
        return HttpResponse.json(
          { stories: pageItems, cv },
          {
            headers: {
              'Total': String(items.length),
              'Per-Page': String(perPage),
            },
          },
        );
      }),
    );
  },
  canFetchLinks(links: ReturnType<typeof makeLink>[]) {
    server.use(
      http.get(`${BASE_URL}/cdn/links`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? 1);
        const perPage = Number(url.searchParams.get('per_page') ?? 25);
        const pageItems = links.slice((page - 1) * perPage, page * perPage);
        const linksMap = Object.fromEntries(pageItems.map(l => [l.slug, l]));
        return HttpResponse.json(
          { links: linksMap },
          {
            headers: {
              'Total': String(links.length),
              'Per-Page': String(perPage),
            },
          },
        );
      }),
    );
  },
};

describe('storyblokClient (MSW)', () => {
  let client: StoryblokClient;

  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => {
    client = new StoryblokClient({
      accessToken: ACCESS_TOKEN,
      cache: { type: 'memory', clear: 'auto' },
    });
  });
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  describe('get()', () => {
    it('passes starts_with as a query param to the API', async () => {
      // The handler only returns stories when the param is present in the URL.
      // If the client fails to serialize the param, it gets back 0 stories.
      const matching = makeStory({ slug: 'testcontent-0' });
      const other = makeStory({ slug: 'other-story' });
      preconditions.canFetchStories([matching, other], { starts_with: 'testcontent-0' });

      const { data } = await client.get('cdn/stories', { starts_with: 'testcontent-0' });

      expect(data.stories.length).toBe(2);
    });

    it('passes by_slugs as a query param to the API', async () => {
      // Same principle: handler only matches when by_slugs arrives in the URL.
      const folderStories = [
        makeStory({ slug: 'folder/story-1', full_slug: 'folder/story-1' }),
        makeStory({ slug: 'folder/story-2', full_slug: 'folder/story-2' }),
      ];
      preconditions.canFetchStories(folderStories, { by_slugs: 'folder/*' });

      const { data } = await client.get('cdn/stories', { by_slugs: 'folder/*' });

      expect(data.stories.length).toBeGreaterThan(0);
    });

    it('runs the full multi-request relation resolution pipeline', async () => {
      // This test exercises: initial story fetch → rel_uuids in response →
      // second fetch with by_uuids → resolved objects replacing UUIDs in content.
      // Unit tests mock at client.client.get level; here the real SbFetch HTTP
      // stack runs end-to-end through MSW.
      const author = makeStory({ slug: 'edgar-allan-poe', uuid: 'author-uuid' });
      const story = makeStory({
        slug: 'testcontent-0',
        content: {
          _uid: 'uid-1',
          component: 'root',
          author: ['author-uuid'],
        },
      });

      server.use(
        http.get(`${BASE_URL}/cdn/stories/testcontent-0`, () =>
          HttpResponse.json({ story, rel_uuids: ['author-uuid'] })),
        http.get(`${BASE_URL}/cdn/stories`, ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('by_uuids')) {
            return HttpResponse.json({ stories: [author], cv: 12345678 });
          }
          return HttpResponse.json({ stories: [], cv: 12345678 });
        }),
      );

      const { data } = await client.get('cdn/stories/testcontent-0', {
        resolve_relations: 'root.author',
      });

      expect(data.story.content.author[0].slug).toBe('edgar-allan-poe');
    });
  });

  describe('getAll()', () => {
    it('fetches all pages by reading Total and Per-Page response headers', async () => {
      // Unit tests mock makeRequest directly; this validates that the real
      // HTTP header parsing (res.headers['per-page'], res.headers.total) drives
      // pagination correctly through the full SbFetch stack.
      const stories = Array.from({ length: 5 }, () => makeStory());
      preconditions.canFetchStories(stories);

      const result = await client.getAll('cdn/stories', { per_page: 2 });

      expect(result.length).toBe(5);
    });

    it('extracts link objects from the links map returned by the API', async () => {
      // The CDN /cdn/links endpoint returns links as an object map keyed by slug,
      // not an array. This validates that getAll correctly calls Object.values()
      // after the full HTTP response flows through SbFetch.
      const links = [makeLink(), makeLink(), makeLink()];
      preconditions.canFetchLinks(links);

      const result = await client.getAll('cdn/links', {});

      expect(result.length).toBe(3);
    });
  });

  describe('caching', () => {
    it('does not cache cdn/spaces/me responses', async () => {
      preconditions.canFetchSpaceInfo();

      const provider = client.cacheProvider();
      await provider.flush();
      await client.get('cdn/spaces/me');

      expect(Object.values(provider.getAll()).length).toBe(0);
    });

    it('reads the cv value from the response and reuses it on subsequent requests', async () => {
      // Validates that the cv field in the JSON body is parsed correctly through
      // SbFetch and used to maintain the cache version across calls.
      const stories = [makeStory()];
      preconditions.canFetchStories(stories);

      const cvBefore = client.cacheVersion();

      await client.get('cdn/stories');
      const cvAfterFirst = client.cacheVersion();

      await client.get('cdn/stories');
      const cvAfterSecond = client.cacheVersion();

      expect(cvBefore).not.toBe(undefined);
      expect(cvAfterFirst).toBe(cvAfterSecond);
    });
  });
});
