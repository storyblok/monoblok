import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAllStories, fetchAllStoriesByComponent, fetchStories } from './actions';
import { handleAPIError } from '../../utils/error';
import type { Story } from './constants';
import { mapiClient } from '../../api';

// Mock dependencies
vi.mock('../../utils/error', () => ({
  handleAPIError: vi.fn(),
}));

// Mock stories data
const mockStories: Story[] = [
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
    parent_id: null,
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
    parent_id: null,
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
  mapiClient({
    token: {
      accessToken: 'valid-token',
    },
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
      mapiClient({
        token: {
          accessToken: 'invalid-token',
        },
        region: 'eu',
      });

      const result = await fetchStories(mockSpace);
      expect(result).toBeUndefined();
      expect(handleAPIError).toHaveBeenCalledWith(
        'pull_stories',
        expect.anything(),
      );

      // Restore valid client
      mapiClient({
        token: {
          accessToken: 'valid-token',
        },
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

  describe('fetchAllStories', () => {
    it('should handle pagination with headers', async () => {
      // Mock multiple pages
      const page1Stories = Array.from({ length: 100 }, (_, i) => ({
        ...mockStories[0],
        id: i + 1,
        name: `Story ${i + 1}`,
        uuid: `uuid-${i + 1}`,
      }));
      const page2Stories = Array.from({ length: 50 }, (_, i) => ({
        ...mockStories[0],
        id: i + 101,
        name: `Story ${i + 101}`,
        uuid: `uuid-${i + 101}`,
      }));

      // Override handler to simulate multi-page response
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/stories', ({ request }) => {
          const url = new URL(request.url);
          const page = Number.parseInt(url.searchParams.get('page') || '1', 10);
          const perPage = 100;
          const total = 150;

          let responseStories;
          if (page === 1) {
            responseStories = page1Stories;
          }
          else if (page === 2) {
            responseStories = page2Stories;
          }
          else {
            responseStories = [];
          }

          const response = HttpResponse.json({ stories: responseStories });
          response.headers.set('Total', total.toString());
          response.headers.set('Per-Page', perPage.toString());

          return response;
        }),
      );

      const result = await fetchAllStories(mockSpace);

      // Should fetch all stories from both pages using header-based pagination
      expect(result).toHaveLength(150);
      expect(result?.[0].id).toBe(1);
      expect(result?.[99].id).toBe(100);
      expect(result?.[100].id).toBe(101);
      expect(result?.[149].id).toBe(150);
    });

    it('should handle single page response', async () => {
      const result = await fetchAllStories(mockSpace);

      // Should return all mock stories from single page
      expect(result).toHaveLength(2);
      expect(result?.[0].id).toBe(1);
      expect(result?.[1].id).toBe(2);
    });
  });

  describe('fetchAllStoriesByComponent', () => {
    const mockSpaceOptions = {
      spaceId: '12345',
    };

    let requestUrl: string | undefined;

    beforeEach(() => {
      requestUrl = undefined;
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/*/stories*', ({ request }) => {
          requestUrl = new URL(request.url).search;
          return HttpResponse.json({ stories: [], per_page: 100, total: 0 });
        }),
      );
    });

    it('should fetch stories without filters', async () => {
      await fetchAllStoriesByComponent(mockSpaceOptions);
      expect(requestUrl).toBe('?per_page=100&page=1');
    });

    it('should fetch stories with component filter', async () => {
      await fetchAllStoriesByComponent(mockSpaceOptions, {
        componentName: 'test-component',
      });
      expect(requestUrl).toBe('?contain_component=test-component&per_page=100&page=1');
    });

    it('should fetch stories with starts_with filter', async () => {
      await fetchAllStoriesByComponent(mockSpaceOptions, {
        starts_with: '/en/blog/',
      });
      expect(requestUrl).toBe('?starts_with=%2Fen%2Fblog%2F&per_page=100&page=1');
    });

    it('should fetch stories with filter_query parameter', async () => {
      await fetchAllStoriesByComponent(mockSpaceOptions, {
        query: '[highlighted][is]=true',
      });
      expect(requestUrl).toContain('filter_query=filter_query%5Bhighlighted%5D%5Bis%5D%3Dtrue');
    });

    it('should handle already prefixed filter_query parameter', async () => {
      await fetchAllStoriesByComponent(mockSpaceOptions, {
        query: 'filter_query[highlighted][is]=true',
      });
      expect(requestUrl).toContain('filter_query=filter_query%5Bhighlighted%5D%5Bis%5D%3Dtrue');
    });

    it('should handle multiple filters together', async () => {
      await fetchAllStoriesByComponent(mockSpaceOptions, {
        componentName: 'test-component',
        starts_with: '/en/blog/',
        query: '[highlighted][is]=true',
      });
      expect(requestUrl).toContain('starts_with=%2Fen%2Fblog%2F');
      expect(requestUrl).toContain('contain_component=test-component');
      expect(requestUrl).toContain('filter_query=filter_query%5Bhighlighted%5D%5Bis%5D%3Dtrue');
    });

    it('should handle error responses', async () => {
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/*/stories*', () => {
          return new HttpResponse(null, { status: 404, statusText: 'Not Found' });
        }),
      );

      const result = await fetchAllStoriesByComponent(mockSpaceOptions);
      expect(result).toEqual([]);
      expect(handleAPIError).toHaveBeenCalledWith(
        'pull_stories',
        expect.anything(),
      );
    });
  });
});
