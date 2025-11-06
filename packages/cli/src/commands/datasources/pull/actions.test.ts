import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import mockedDatasources from './datasource.mock.json' assert { type: 'json' };
import { mapiClient } from '../../../api';
import { fetchDatasources, saveDatasourcesToFiles } from './actions';
import { vol } from 'memfs';

const MAX_RETRY_DURATION = 14_000;

/**
 * Helper function to create paginated responses
 */
function createPaginatedResponse<T>(items: T[], request: Request, perPage = 25) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page')) || 1;

  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const paginatedItems = items.slice(startIndex, endIndex);
  return {
    items: paginatedItems,
    headers: {
      total: String(items.length),
      page: String(page),
    },
  };
}

// Track request counts globally
let datasourcesPageRequests = 0;
let entriesPageRequests = 0;

const handlers = [
  http.get('https://mapi.storyblok.com/v1/spaces/12345/datasources', async ({ request }) => {
    datasourcesPageRequests++;
    const token = request.headers.get('Authorization');
    if (token === 'valid-token') {
      const { items, headers } = createPaginatedResponse(mockedDatasources, request);

      return HttpResponse.json({
        datasources: items.map(({ entries, ...rest }) => rest),
      }, { headers });
    }
    return HttpResponse.text('Unauthorized', { status: 401 });
  }),
  http.get('https://mapi.storyblok.com/v1/spaces/12345/datasource_entries', async ({ request }) => {
    entriesPageRequests++;
    const url = new URL(request.url);
    const datasourceId = url.searchParams.get('datasource_id');

    const allEntries = mockedDatasources.find(ds => ds.id === Number(datasourceId))?.entries || [];
    const { items, headers } = createPaginatedResponse(allEntries, request);

    return HttpResponse.json({
      datasource_entries: items,
    }, { headers });
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
    vi.useFakeTimers();
    // Reset counters before each test
    datasourcesPageRequests = 0;
    entriesPageRequests = 0;
    mapiClient({
      token: {
        accessToken: 'valid-token',
      },
      region: 'eu',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  describe('fetchDatasources', () => {
    it('should fetch all datasources across multiple pages', async () => {
      const resultPromise = fetchDatasources('12345');
      await vi.advanceTimersByTimeAsync(MAX_RETRY_DURATION);
      const result = await resultPromise;
      expect(result).toBeDefined();

      // Test the structure of the first datasource
      const firstDatasource = result?.[0];
      // Should fetch all 51 datasources (2 pages at 25 per page)
      expect(result).toHaveLength(51);
      expect(firstDatasource).toHaveProperty('name');
      expect(firstDatasource).toHaveProperty('entries');
      expect(Array.isArray(firstDatasource?.entries)).toBe(true);
      expect(firstDatasource).toMatchObject({
        id: expect.any(Number),
        name: expect.any(String),
        slug: expect.any(String),
        dimensions: expect.any(Array),
        created_at: expect.any(String),
        updated_at: expect.any(String),
        entries: expect.any(Array), // New: entries property
      });
    });

    it('should fetch all datasource entries across multiple pages', async () => {
      const resultPromise = fetchDatasources('12345');
      await vi.advanceTimersByTimeAsync(MAX_RETRY_DURATION);
      const result = await resultPromise;

      // Find the "colors" datasource which has 33 entries (needs 2 pages at 25 per page)
      const colorsDatasource = result?.find(ds => ds.name === 'colors');
      expect(colorsDatasource).toBeDefined();
      expect(colorsDatasource?.entries).toHaveLength(33);
      expect(colorsDatasource?.entries?.[0]).toMatchObject({
        id: 99540095392100,
        name: 'Red',
        value: 'red',
        dimension_value: '',
        datasource_id: 1,
      });
      // Verify some specific entries to ensure all pages were fetched
      const entryNames = colorsDatasource?.entries?.map(e => e.name);
      expect(entryNames).toContain('Red'); // First page
      expect(entryNames).toContain('white'); // Second page (entry 33)
    });

    it('should handle pagination headers correctly', async () => {
      const resultPromise = fetchDatasources('12345');
      await vi.advanceTimersByTimeAsync(MAX_RETRY_DURATION);
      const result = await resultPromise;
      // Should make 3 requests for datasources (51 items / 25 per page)
      expect(datasourcesPageRequests).toBe(3);

      // Should fetch all datasources and their entries
      expect(result).toHaveLength(51);

      // Verify multiple pagination requests were made for datasource entries
      // The colors datasource has 33 entries, requiring 2 pages
      expect(entriesPageRequests).toBeGreaterThan(50); // At least one request per datasource
    });
    it('should handle empty datasources response', async () => {
      // Override the handler to return empty datasources
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/12345/datasources', () => {
          return HttpResponse.json({
            datasources: [],
          });
        }),
      );

      const resultPromise = fetchDatasources('12345');
      await vi.advanceTimersByTimeAsync(MAX_RETRY_DURATION);
      const result = await resultPromise;

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle network errors', async () => {
      // Override the handler to simulate network error
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/12345/datasources', () => {
          return HttpResponse.error();
        }),
      );

      await expect(Promise.all([
        fetchDatasources('12345'),
        vi.advanceTimersByTimeAsync(MAX_RETRY_DURATION),
      ])).rejects.toThrow();
    });

    it('should handle server errors', async () => {
      // Override the handler to return server error
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/12345/datasources', () => {
          return new HttpResponse('Internal Server Error', { status: 500 });
        }),
      );

      await expect(Promise.all([
        fetchDatasources('12345'),
        vi.advanceTimersByTimeAsync(MAX_RETRY_DURATION),
      ])).rejects.toThrow();
    });
    /*  it('should throw a masked error for invalid token', async () => {
      // Configure client with invalid token
      mapiClient({
        token: {
          accessToken: 'invalid-token',
        },
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
    }); */
    it('should make request to correct endpoint with space parameter', async () => {
      let requestUrl = '';

      // Override handler to capture request URL
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/*/datasources', ({ request }) => {
          requestUrl = request.url;
          return HttpResponse.json({
            datasources: [],
          });
        }),
      );

      const resultPromise = fetchDatasources('54321');
      await vi.advanceTimersByTimeAsync(MAX_RETRY_DURATION);
      await resultPromise;
      expect(requestUrl).toBe('https://mapi.storyblok.com/v1/spaces/54321/datasources?page=1');
    });
  });

  describe('saveDatasourcesToFiles', () => {
    beforeEach(() => {
      vol.reset();
    });

    it('should save datasources to a single consolidated file', async () => {
      vol.fromJSON({
        '/mock/path/': null,
      });
      await saveDatasourcesToFiles('12345', mockedDatasources, {
        path: '/mock/path/',
        filename: 'datasources',
        verbose: false,
      });
      const files = vol.readdirSync('/mock/path/datasources/12345');
      expect(files).toEqual(['datasources.json']);
      const fileContent = vol.readFileSync('/mock/path/datasources/12345/datasources.json').toString();
      const parsed = JSON.parse(fileContent);
      expect(parsed).toHaveLength(51);
      expect(parsed[0]).toHaveProperty('entries');
    });

    it('should save datasources to separate files', async () => {
      vol.fromJSON({
        '/mock/path2/': null,
      });
      await saveDatasourcesToFiles('12345', mockedDatasources, {
        path: '/mock/path2/',
        separateFiles: true,
        verbose: false,
      });
      const files = vol.readdirSync('/mock/path2/datasources/12345');
      expect(files.sort()).toEqual(mockedDatasources.map(ds => `${ds.name}.json`).sort());
      const colorsContent = vol.readFileSync('/mock/path2/datasources/12345/colors.json').toString();
      const parsedColors = JSON.parse(colorsContent);
      expect(parsedColors).toHaveProperty('entries');
      expect(parsedColors.entries[0].name).toBe('Red');
    });
  });
});
