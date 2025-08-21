import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStories, fetchStoriesByComponent } from './actions';
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
  http.get('https://api.storyblok.com/v1/spaces/:spaceId/stories', ({ request }) => {
    const token = request.headers.get('Authorization');

    if (token !== 'valid-token') {
      return new HttpResponse(null, { status: 401 });
    }

    // Get URL to check for query parameters
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // If filter_query is present, handle it specially
    if (url.searchParams.has('filter_query')) {
      try {
        const filterQuery = JSON.parse(decodeURIComponent(url.searchParams.get('filter_query') || '{}'));

        // If filtering for specific component
        if (filterQuery.component && filterQuery.component.in) {
          if (filterQuery.component.in.includes('article')) {
            // Return only the first story for article component
            return HttpResponse.json({ stories: [mockStories[0]], per_page: 100, total: 1 });
          }
        }
      }
      catch {
        // If JSON parsing fails, return an error
        return new HttpResponse(null, { status: 400 });
      }
    }

    // Handle filtering by published status
    if (searchParams.has('is_published')) {
      const isPublished = searchParams.get('is_published') === 'true';
      const filteredStories = mockStories.filter(story => story.published === isPublished);
      return HttpResponse.json({ stories: filteredStories, per_page: 100, total: filteredStories.length });
    }

    // Handle pagination
    if (searchParams.has('page')) {
      const page = Number.parseInt(searchParams.get('page') || '1', 10);
      if (page > 1) {
        // Simulate empty second page
        return HttpResponse.json({ stories: [], per_page: 100, total: 2 });
      }
    }

    // Handle tag filtering
    if (searchParams.has('with_tag')) {
      const tag = searchParams.get('with_tag');
      if (tag === 'featured') {
        // Only return the first story for featured tag
        return HttpResponse.json({ stories: [mockStories[0]], per_page: 100, total: 1 });
      }
    }

    // Default response with all stories
    return HttpResponse.json({ stories: mockStories, per_page: 100, total: mockStories.length });
  }),
];

const server = setupServer(...handlers);

// Set up the MSW server
beforeAll(() => server.listen());
beforeEach(() => {
  if (mapiClient().dispose) {
    mapiClient().dispose();
  }
  mapiClient({
    token: 'valid-token',
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
      const result = await fetchStories(mockSpace).catch(() => undefined);
      expect(result).toEqual(mockStories);
    });

    it('should fetch stories with query parameters', async () => {
      const result = await fetchStories(mockSpace, {
        with_tag: 'featured',
      }).catch(() => undefined);

      // Should return only the first story due to the 'featured' tag filter in our handler
      expect(result).toHaveLength(1);
      expect(result?.[0].id).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const result = await fetchStories(mockSpace, {
        page: 2,
      }).catch(() => undefined);

      // Should return empty array for page 2 based on our handler
      expect(result).toHaveLength(0);
    });

    it('should handle filtering by published status', async () => {
      const result = await fetchStories(mockSpace, {
        is_published: true,
      }).catch(() => undefined);

      // All our mock stories are published
      expect(result).toHaveLength(2);
    });

    it('should handle complex query parameters with objects', async () => {
      const result = await fetchStories(mockSpace, {
        filter_query: JSON.stringify({
          'component': { in: ['article', 'news'] },
          'content.category': { in: ['technology'] },
        }),
      }).catch(() => undefined);

      // Should return all stories since the filter query doesn't match our handler logic
      expect(result).toHaveLength(2);
      expect(result?.[0].id).toBe(1);
    });

    it('should handle unauthorized errors', async () => {
      // Temporarily dispose and create a client with invalid token
      mapiClient().dispose();
      mapiClient({
        token: 'invalid-token',
        region: 'eu',
      });

      await fetchStories(mockSpace).catch(() => {
        expect(handleAPIError).toHaveBeenCalledWith(
          'pull_stories',
          expect.any(Error),
        );
      });

      // Restore valid client
      mapiClient().dispose();
      mapiClient({
        token: 'valid-token',
        region: 'eu',
      });
    });

    it('should handle server errors', async () => {
      // Override handler to simulate a server error
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/:spaceId/stories', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      await fetchStories(mockSpace).catch(() => {
        expect(handleAPIError).toHaveBeenCalledWith(
          'pull_stories',
          expect.any(Error),
        );
      });
    });

    it('should handle pagination when per_page and total are missing from response', async () => {
      // Mock pages
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

      // Override handler to simulate API without pagination metadata
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/:spaceId/stories', ({ request }) => {
          const url = new URL(request.url);
          const page = Number.parseInt(url.searchParams.get('page') || '1', 10);

          if (page === 1) {
            // First page returns 100 stories (no per_page and total fields)
            return HttpResponse.json({ stories: page1Stories });
          }
          else if (page === 2) {
            // Second page returns 50 stories (less than per_page, indicating end)
            return HttpResponse.json({ stories: page2Stories });
          }
          else {
            // Third page returns empty array
            return HttpResponse.json({ stories: [] });
          }
        }),
      );

      const result = await fetchStories(mockSpace);

      // Should fetch all stories from both pages
      expect(result).toHaveLength(150);
      expect(result?.[0].id).toBe(1);
      expect(result?.[99].id).toBe(100);
      expect(result?.[100].id).toBe(101);
      expect(result?.[149].id).toBe(150);
    });
  });

  describe('fetchStoriesByComponent', () => {
    const mockSpaceOptions = {
      spaceId: '12345',
    };

    let requestUrl: string | undefined;

    beforeEach(() => {
      requestUrl = undefined;
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/*/stories*', ({ request }) => {
          requestUrl = new URL(request.url).search;
          return HttpResponse.json({ stories: [], per_page: 100, total: 0 });
        }),
      );
    });

    it('should fetch stories without filters', async () => {
      await fetchStoriesByComponent(mockSpaceOptions);
      expect(requestUrl).toBe('?per_page=100');
    });

    it('should fetch stories with component filter', async () => {
      await fetchStoriesByComponent(mockSpaceOptions, {
        componentName: 'test-component',
      });
      expect(requestUrl).toBe('?contain_component=test-component&per_page=100');
    });

    it('should fetch stories with starts_with filter', async () => {
      await fetchStoriesByComponent(mockSpaceOptions, {
        starts_with: '/en/blog/',
      });
      expect(requestUrl).toBe('?starts_with=%2Fen%2Fblog%2F&per_page=100');
    });

    it('should fetch stories with filter_query parameter', async () => {
      await fetchStoriesByComponent(mockSpaceOptions, {
        query: '[highlighted][is]=true',
      });
      expect(requestUrl).toBe('?per_page=100&filter_query[highlighted][is]=true');
    });

    it('should handle already prefixed filter_query parameter', async () => {
      await fetchStoriesByComponent(mockSpaceOptions, {
        query: 'filter_query[highlighted][is]=true',
      });
      expect(requestUrl).toBe('?per_page=100&filter_query[highlighted][is]=true');
    });

    it('should handle multiple filters together', async () => {
      await fetchStoriesByComponent(mockSpaceOptions, {
        componentName: 'test-component',
        starts_with: '/en/blog/',
        query: '[highlighted][is]=true',
      });
      expect(requestUrl).toBe('?starts_with=%2Fen%2Fblog%2F&contain_component=test-component&per_page=100&filter_query[highlighted][is]=true');
    });

    it('should handle error responses', async () => {
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/*/stories*', () => {
          return new HttpResponse(null, { status: 404, statusText: 'Not Found' });
        }),
      );

      const result = await fetchStoriesByComponent(mockSpaceOptions);
      expect(result).toEqual([]);
      expect(handleAPIError).toHaveBeenCalledWith(
        'pull_stories',
        expect.any(Error),
      );
    });
  });
});
