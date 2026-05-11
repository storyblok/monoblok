import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStories, prefetchTargetStoriesByKeys } from './actions';
import { getMapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';

// Mock dependencies
vi.mock('../../utils/error/api-error', () => ({
  handleAPIError: vi.fn(),
}));

// Mock stories data
const mockStories = [
  {
    id: 1,
    name: 'Story 1',
    uuid: 'uuid-1',
    slug: 'story-1',
    full_slug: 'story-1',
    content: {
      _uid: 'uid-1',
      component: 'page',
    },
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    published_at: '2023-01-01T00:00:00Z',
    first_published_at: '2023-01-01T00:00:00Z',
    published: true,
    unpublished_changes: false,
    is_startpage: false,
    is_folder: false,
    pinned: false,
    parent_id: 0,
    group_id: 'group-1',
    parent: null,
    path: null,
    position: 0,
    sort_by_date: null,
    tag_list: [],
    disable_fe_editor: false,
    default_root: null,
    preview_token: null,
    meta_data: null,
    release_id: null,
    last_author: null,
    last_author_id: null,
    alternates: [],
    translated_slugs: null,
    translated_slugs_attributes: null,
    localized_paths: null,
    breadcrumbs: [],
    scheduled_dates: null,
    favourite_for_user_ids: [],
    imported_at: null,
    deleted_at: null,
  },
  {
    id: 2,
    name: 'Story 2',
    uuid: 'uuid-2',
    slug: 'story-2',
    full_slug: 'story-2',
    content: {
      _uid: 'uid-2',
      component: 'page',
    },
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    published_at: '2023-01-02T00:00:00Z',
    first_published_at: '2023-01-02T00:00:00Z',
    published: true,
    unpublished_changes: false,
    is_startpage: false,
    is_folder: false,
    pinned: false,
    parent_id: 0,
    group_id: 'group-2',
    parent: null,
    path: null,
    position: 1,
    sort_by_date: null,
    tag_list: [],
    disable_fe_editor: false,
    default_root: null,
    preview_token: null,
    meta_data: null,
    release_id: null,
    last_author: null,
    last_author_id: null,
    alternates: [],
    translated_slugs: null,
    translated_slugs_attributes: null,
    localized_paths: null,
    breadcrumbs: [],
    scheduled_dates: null,
    favourite_for_user_ids: [],
    imported_at: null,
    deleted_at: null,
  },
];

// Set up MSW handlers
const handlers = [
  http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', ({ request }) => {
    const token = request.headers.get('Authorization');

    if (token !== 'valid-token') {
      return new HttpResponse(null, { status: 401 });
    }

    // Get URL to check for query parameters
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    let responseStories = mockStories;
    let total = mockStories.length;

    // If filter_query is present, handle it specially
    if (url.searchParams.has('filter_query')) {
      try {
        const filterQuery = JSON.parse(decodeURIComponent(url.searchParams.get('filter_query') || '{}'));

        // If filtering for specific component
        if (filterQuery.component && filterQuery.component.in) {
          if (filterQuery.component.in.includes('article')) {
            // Return only the first story for article component
            responseStories = [mockStories[0]];
            total = 1;
          }
        }
      }
      catch {
        // If JSON parsing fails, return an error
        return new HttpResponse(null, { status: 400 });
      }
    }
    // Handle filtering by published status
    else if (searchParams.has('is_published')) {
      const isPublished = searchParams.get('is_published') === 'true';
      responseStories = mockStories.filter(story => story.published === isPublished);
      total = responseStories.length;
    }
    // Handle tag filtering
    else if (searchParams.has('with_tag')) {
      const tag = searchParams.get('with_tag');
      if (tag === 'featured') {
        // Only return the first story for featured tag
        responseStories = [mockStories[0]];
        total = 1;
      }
    }

    // Handle pagination
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const perPage = Number.parseInt(searchParams.get('per_page') || '100', 10);

    if (page > 1) {
      // Simulate empty second page
      responseStories = [];
    }

    // Create response with headers (headers are always present in real API)
    const response = HttpResponse.json({ stories: responseStories });
    response.headers.set('Total', total.toString());
    response.headers.set('Per-Page', perPage.toString());

    return response;
  }),
];

const server = setupServer(...handlers);

// Set up the MSW server
beforeAll(() => server.listen());
beforeEach(() => {
  getMapiClient({
    personalAccessToken: 'valid-token',
    region: 'eu',
  });
});
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('stories/actions', () => {
  const mockSpace = '12345';

  describe('fetchStories', () => {
    it('should fetch stories without query parameters', async () => {
      const result = await fetchStories(mockSpace);
      expect(result).toBeDefined();
      expect(result?.stories).toEqual(mockStories);
      expect(result?.headers).toBeDefined();
    });

    it('should fetch stories with query parameters', async () => {
      const result = await fetchStories(mockSpace, {
        with_tag: 'featured',
      });

      // Should return only the first story due to the 'featured' tag filter in our handler
      expect(result?.stories).toHaveLength(1);
      expect(result?.stories[0].id).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const result = await fetchStories(mockSpace, {
        page: 2,
      });

      // Should return empty array for page 2 based on our handler
      expect(result?.stories).toHaveLength(0);
    });

    it('should handle filtering by published status', async () => {
      const result = await fetchStories(mockSpace, {
        is_published: true,
      });

      // All our mock stories are published
      expect(result?.stories).toHaveLength(2);
    });

    it('should handle complex query parameters with objects', async () => {
      const result = await fetchStories(mockSpace, {
        filter_query: JSON.stringify({
          'component': { in: ['article', 'news'] },
          'content.category': { in: ['technology'] },
        }),
      });

      // Should return only the first story due to the 'article' component filter in our handler
      expect(result?.stories).toHaveLength(1);
      expect(result?.stories[0].id).toBe(1);
    });

    it('should handle unauthorized errors', async () => {
      // Temporarily create a client with invalid token
      getMapiClient({
        personalAccessToken: 'invalid-token',
        region: 'eu',
      });

      const result = await fetchStories(mockSpace);
      expect(result).toBeUndefined();
      expect(handleAPIError).toHaveBeenCalledWith(
        'pull_stories',
        expect.anything(),
      );

      // Restore valid client
      getMapiClient({
        personalAccessToken: 'valid-token',
        region: 'eu',
      });
    });

    it('should handle server errors', async () => {
      // Override handler to simulate a server error
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      const result = await fetchStories(mockSpace);
      expect(result).toBeUndefined();
      expect(handleAPIError).toHaveBeenCalledWith(
        'pull_stories',
        expect.anything(),
      );
    });
  });

  describe('prefetchTargetStoriesByKeys', () => {
    const space = '12345';

    const buildRemoteStory = (overrides: { id: number; uuid: string; full_slug: string; is_folder?: boolean }) => ({
      ...mockStories[0],
      ...overrides,
      slug: overrides.full_slug.split('/').pop()!,
      is_folder: overrides.is_folder ?? false,
    });

    it('returns empty maps when no keys are provided', async () => {
      const result = await prefetchTargetStoriesByKeys(space, { slugs: [], ids: [] });
      expect(result.bySlug.size).toBe(0);
      expect(result.byId.size).toBe(0);
    });

    it('fetches stories by slug and indexes them by normalized full_slug and id', async () => {
      const remote = buildRemoteStory({ id: 7, uuid: 'uuid-7', full_slug: 'home' });
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('by_slugs')).toBe('home');
          return HttpResponse.json(
            { stories: [remote] },
            { headers: { 'Total': '1', 'Per-Page': '100' } },
          );
        }),
      );

      const result = await prefetchTargetStoriesByKeys(space, { slugs: ['home'], ids: [] });

      expect(result.bySlug.get('home')).toEqual([
        { id: 7, uuid: 'uuid-7', is_folder: false },
      ]);
      expect(result.byId.get(7)).toEqual({ id: 7, uuid: 'uuid-7', is_folder: false });
    });

    it('stores folder + startpage that share a full_slug as separate entries', async () => {
      const folder = buildRemoteStory({ id: 10, uuid: 'uuid-folder', full_slug: 'about', is_folder: true });
      const startpage = buildRemoteStory({ id: 11, uuid: 'uuid-startpage', full_slug: 'about', is_folder: false });

      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', () =>
          HttpResponse.json(
            { stories: [folder, startpage] },
            { headers: { 'Total': '2', 'Per-Page': '100' } },
          )),
      );

      const result = await prefetchTargetStoriesByKeys(space, { slugs: ['about'], ids: [] });

      const entries = result.bySlug.get('about');
      expect(entries).toHaveLength(2);
      expect(entries).toEqual(expect.arrayContaining([
        { id: 10, uuid: 'uuid-folder', is_folder: true },
        { id: 11, uuid: 'uuid-startpage', is_folder: false },
      ]));
    });

    it('omits slugs that have no remote match', async () => {
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', () =>
          HttpResponse.json(
            { stories: [] },
            { headers: { 'Total': '0', 'Per-Page': '100' } },
          )),
      );

      const result = await prefetchTargetStoriesByKeys(space, { slugs: ['missing'], ids: [] });

      expect(result.bySlug.has('missing')).toBe(false);
    });

    it('treats slugs as exact matches (no wildcard interpretation)', async () => {
      let captured: string | null = null;
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', ({ request }) => {
          captured = new URL(request.url).searchParams.get('by_slugs');
          return HttpResponse.json(
            { stories: [] },
            { headers: { 'Total': '0', 'Per-Page': '100' } },
          );
        }),
      );

      await prefetchTargetStoriesByKeys(space, { slugs: ['foo/bar'], ids: [] });

      // The literal slug is sent as-is; callers should not be expected to
      // escape characters because real Storyblok slugs cannot contain `*`/`?`.
      expect(captured).toBe('foo/bar');
    });

    it('fetches stories by id and indexes them by id and full_slug', async () => {
      const remote = buildRemoteStory({ id: 99, uuid: 'uuid-99', full_slug: 'pricing' });
      let captured: string | null = null;
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', ({ request }) => {
          const url = new URL(request.url);
          captured = url.searchParams.get('by_ids');
          expect(url.searchParams.get('by_slugs')).toBeNull();
          return HttpResponse.json(
            { stories: [remote] },
            { headers: { 'Total': '1', 'Per-Page': '100' } },
          );
        }),
      );

      const result = await prefetchTargetStoriesByKeys(space, { slugs: [], ids: [99] });

      expect(captured).toBe('99');
      expect(result.byId.get(99)).toEqual({ id: 99, uuid: 'uuid-99', is_folder: false });
      expect(result.bySlug.get('pricing')).toEqual([
        { id: 99, uuid: 'uuid-99', is_folder: false },
      ]);
    });

    it('paginates when a chunk returns more results than one page', async () => {
      const perPage = 100;
      const page1 = Array.from({ length: perPage }, (_, i) =>
        buildRemoteStory({ id: i + 1, uuid: `uuid-p1-${i + 1}`, full_slug: `s${i + 1}` }));
      const page2 = [
        buildRemoteStory({ id: 1001, uuid: 'uuid-p2-1', full_slug: 's1', is_folder: true }),
        buildRemoteStory({ id: 1002, uuid: 'uuid-p2-2', full_slug: 's2', is_folder: true }),
      ];
      const total = page1.length + page2.length;

      const pagesSeen: number[] = [];
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', ({ request }) => {
          const page = Number(new URL(request.url).searchParams.get('page') || '1');
          pagesSeen.push(page);
          const stories = page === 1 ? page1 : page === 2 ? page2 : [];
          return HttpResponse.json(
            { stories },
            { headers: { 'Total': String(total), 'Per-Page': String(perPage) } },
          );
        }),
      );

      const slugs = page1.map(s => s.full_slug);
      const result = await prefetchTargetStoriesByKeys(space, { slugs, ids: [] });

      expect(pagesSeen).toEqual([1, 2]);
      expect(result.byId.size).toBe(total);
      // s1 and s2 each appear on page 2 as folders alongside their page-1 entry.
      expect(result.bySlug.get('s1')).toHaveLength(2);
      expect(result.bySlug.get('s2')).toHaveLength(2);
      expect(result.bySlug.get('s3')).toHaveLength(1);
    });

    it('deduplicates a story returned by both slug and id queries', async () => {
      const remote = buildRemoteStory({ id: 42, uuid: 'uuid-42', full_slug: 'shared' });

      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', () =>
          HttpResponse.json(
            { stories: [remote] },
            { headers: { 'Total': '1', 'Per-Page': '100' } },
          )),
      );

      const result = await prefetchTargetStoriesByKeys(space, { slugs: ['shared'], ids: [42] });

      expect(result.bySlug.get('shared')).toHaveLength(1);
      expect(result.byId.get(42)?.uuid).toBe('uuid-42');
    });
  });
});
