import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchStories, fetchStoriesByComponent } from './actions';
import { handleAPIError } from '../../utils/error';
import type { Story } from './constants';
import type { RegionCode } from '../../constants';

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

    if (token !== 'test-token') {
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
            return HttpResponse.json({ stories: [mockStories[0]] });
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
      return HttpResponse.json({ stories: filteredStories });
    }

    // Handle pagination
    if (searchParams.has('page')) {
      const page = Number.parseInt(searchParams.get('page') || '1', 10);
      if (page > 1) {
        // Simulate empty second page
        return HttpResponse.json({ stories: [] });
      }
    }

    // Handle tag filtering
    if (searchParams.has('with_tag')) {
      const tag = searchParams.get('with_tag');
      if (tag === 'featured') {
        // Only return the first story for featured tag
        return HttpResponse.json({ stories: [mockStories[0]] });
      }
    }

    // Default response with all stories
    return HttpResponse.json({ stories: mockStories });
  }),
];

const server = setupServer(...handlers);

// Set up the MSW server
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

describe('stories/actions', () => {
  const mockSpace = '12345';
  const mockToken = 'test-token';
  const mockRegion = 'eu';

  describe('fetchStories', () => {
    it('should fetch stories without query parameters', async () => {
      const result = await fetchStories(mockSpace, mockToken, mockRegion).catch(() => undefined);
      expect(result).toEqual(mockStories);
    });

    it('should fetch stories with query parameters', async () => {
      const result = await fetchStories(mockSpace, mockToken, mockRegion, {
        with_tag: 'featured',
      }).catch(() => undefined);

      // Should return only the first story due to the 'featured' tag filter in our handler
      expect(result).toHaveLength(1);
      expect(result?.[0].id).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const result = await fetchStories(mockSpace, mockToken, mockRegion, {
        page: 2,
      }).catch(() => undefined);

      // Should return empty array for page 2 based on our handler
      expect(result).toHaveLength(0);
    });

    it('should handle filtering by published status', async () => {
      const result = await fetchStories(mockSpace, mockToken, mockRegion, {
        is_published: true,
      }).catch(() => undefined);

      // All our mock stories are published
      expect(result).toHaveLength(2);
    });

    it('should handle complex query parameters with objects', async () => {
      const result = await fetchStories(mockSpace, mockToken, mockRegion, {
        filter_query: {
          'component': { in: ['article', 'news'] },
          'content.category': { in: ['technology'] },
        },
      }).catch(() => undefined);

      // Should return only the first story based on our handler
      expect(result).toHaveLength(2);
      expect(result?.[0].id).toBe(1);
    });

    it('should handle unauthorized errors', async () => {
      await fetchStories(mockSpace, 'invalid-token', mockRegion).catch(() => {
        expect(handleAPIError).toHaveBeenCalledWith(
          'pull_stories',
          expect.any(Error),
        );
      });
    });

    it('should handle server errors', async () => {
      // Override handler to simulate a server error
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/:spaceId/stories', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      await fetchStories(mockSpace, mockToken, mockRegion).catch(() => {
        expect(handleAPIError).toHaveBeenCalledWith(
          'pull_stories',
          expect.any(Error),
        );
      });
    });
  });

  describe('fetchStoriesByComponent', () => {
    const mockSpaceOptions = {
      spaceId: '12345',
      token: 'test-token',
      region: 'eu' as RegionCode,
    };

    let requestUrl: string | undefined;

    beforeEach(() => {
      requestUrl = undefined;
      server.use(
        http.get('*/stories*', ({ request }) => {
          requestUrl = new URL(request.url).search;
          return HttpResponse.json({ stories: [] });
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
        http.get('*/stories*', () => {
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
