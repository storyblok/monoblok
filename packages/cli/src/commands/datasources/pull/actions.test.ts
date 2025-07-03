import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDatasources } from './actions';
import { mapiClient } from '../../../api';
import type { SpaceDatasource, SpaceDatasourceEntry } from '../constants';

// Mock datasources data that matches the SpaceDatasource interface
const mockedDatasources: SpaceDatasource[] = [
  {
    id: 1,
    name: 'Countries',
    slug: 'countries',
    dimensions: [
      {
        name: 'United States',
        type: 'option',
        entry_value: 'us',
        datasource_id: 1,
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
      },
      {
        name: 'Canada',
        type: 'option',
        entry_value: 'ca',
        datasource_id: 1,
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
      },
    ],
    created_at: '2021-08-09T12:00:00Z',
    updated_at: '2021-08-09T12:00:00Z',
  },
  {
    id: 2,
    name: 'Categories',
    slug: 'categories',
    dimensions: [
      {
        name: 'Technology',
        type: 'option',
        entry_value: 'tech',
        datasource_id: 2,
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
      },
      {
        name: 'Business',
        type: 'option',
        entry_value: 'business',
        datasource_id: 2,
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
      },
    ],
    created_at: '2021-08-09T12:00:00Z',
    updated_at: '2021-08-09T12:00:00Z',
  },
];

// Mock datasource entries data
const mockedEntries: Record<number, SpaceDatasourceEntry[]> = {
  1: [
    { id: 101, name: 'blue', value: '#0000ff', dimension_value: '' },
    { id: 102, name: 'red', value: '#ff0000', dimension_value: '' },
  ],
  2: [
    { id: 201, name: 'tech', value: 'Technology', dimension_value: '' },
    { id: 202, name: 'business', value: 'Business', dimension_value: '' },
  ],
};

// MSW handlers for mocking the datasources API endpoint
const handlers = [
  http.get('https://api.storyblok.com/v1/spaces/12345/datasources', async ({ request }) => {
    const token = request.headers.get('Authorization');

    // Return success response for valid token
    if (token === 'valid-token') {
      return HttpResponse.json({
        datasources: mockedDatasources,
      });
    }

    // Return unauthorized error for invalid token
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
  http.get('https://api.storyblok.com/v1/spaces/:space/datasource_entries', async ({ request }) => {
    const url = new URL(request.url);
    const datasourceId = url.searchParams.get('datasource_id');
    const entries = mockedEntries[Number(datasourceId)] || [];
    return HttpResponse.json({ datasource_entries: entries });
  }),
];

// Set up MSW server
const server = setupServer(...handlers);

// Setup and teardown for MSW server
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock filesystem modules
vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('pull datasources actions', () => {
  beforeEach(() => {
    // Reset and configure the MAPI client before each test
    mapiClient().dispose();
    mapiClient({
      token: 'valid-token',
      region: 'eu',
    });
  });

  describe('fetchDatasources', () => {
    it('should fetch datasources successfully with a valid token', async () => {
      const result = await fetchDatasources('12345');

      // Each datasource should now have an 'entries' property
      expect(result).toHaveLength(2);
      expect(result?.[0]).toMatchObject({
        id: 1,
        name: 'Countries',
        slug: 'countries',
        dimensions: expect.any(Array),
        entries: mockedEntries[1],
      });
      expect(result?.[1]).toMatchObject({
        id: 2,
        name: 'Categories',
        slug: 'categories',
        dimensions: expect.any(Array),
        entries: mockedEntries[2],
      });
      // Ensure entries is an array
      expect(Array.isArray(result?.[0].entries)).toBe(true);
      expect(Array.isArray(result?.[1].entries)).toBe(true);
    });

    it('should return datasources with correct structure', async () => {
      const result = await fetchDatasources('12345');

      expect(result).toBeDefined();

      // Test the structure of the first datasource
      const firstDatasource = result?.[0];
      expect(firstDatasource).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        slug: expect.any(String),
        dimensions: expect.any(Array),
        created_at: expect.any(String),
        updated_at: expect.any(String),
        entries: expect.any(Array), // New: entries property
      });
      // Test the structure of an entry
      const firstEntry = firstDatasource?.entries?.[0];
      if (firstEntry) {
        expect(firstEntry).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          value: expect.any(String),
          dimension_value: expect.any(String),
        });
      }
    });

    it('should handle empty datasources response', async () => {
      // Override the handler to return empty datasources
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/12345/datasources', () => {
          return HttpResponse.json({
            datasources: [],
          });
        }),
      );

      const result = await fetchDatasources('12345');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should throw a masked error for invalid token', async () => {
      // Configure client with invalid token
      mapiClient().dispose();
      mapiClient({
        token: 'invalid-token',
        region: 'eu',
      });

      await expect(fetchDatasources('12345')).rejects.toThrow(
        expect.objectContaining({
          name: 'API Error',
          message: 'The user is not authorized to access the API',
          cause: 'The user is not authorized to access the API',
          errorId: 'unauthorized',
          code: 401,
          messageStack: [
            'Failed to pull datasources',
            'The user is not authorized to access the API',
          ],
        }),
      );
    });

    it('should handle network errors', async () => {
      // Override the handler to simulate network error
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/12345/datasources', () => {
          return HttpResponse.error();
        }),
      );

      await expect(fetchDatasources('12345')).rejects.toThrow();
    });

    it('should handle server errors', async () => {
      // Override the handler to return server error
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/12345/datasources', () => {
          return new HttpResponse('Internal Server Error', { status: 500 });
        }),
      );

      await expect(fetchDatasources('12345')).rejects.toThrow();
    });

    it('should make request to correct endpoint with space parameter', async () => {
      let requestUrl = '';

      // Override handler to capture request URL
      server.use(
        http.get('https://api.storyblok.com/v1/spaces/*/datasources', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            datasources: mockedDatasources,
          });
        }),
      );

      await fetchDatasources('54321');

      expect(requestUrl).toBe('https://api.storyblok.com/v1/spaces/54321/datasources');
    });
  });
});
