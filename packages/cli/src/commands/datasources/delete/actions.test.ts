import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { SpaceDatasource, SpaceDatasourceEntry } from '../constants';
import { mapiClient } from '../../../api';
import { deleteDatasource, deleteDatasourceByName } from './actions';

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
    { id: 101, name: 'blue', value: '#0000ff', dimension_value: '', datasource_id: 1 },
    { id: 102, name: 'red', value: '#ff0000', dimension_value: '', datasource_id: 1 },
  ],
  2: [
    { id: 201, name: 'tech', value: 'Technology', dimension_value: '', datasource_id: 2 },
    { id: 202, name: 'business', value: 'Business', dimension_value: '', datasource_id: 2 },
  ],
};

// MSW handlers for mocking the datasources API endpoint
const handlers = [
  http.get('https://api.storyblok.com/v1/spaces/12345/datasources?search=countries', async ({ request }) => {
    const token = request.headers.get('Authorization');

    // Return success response for valid token
    if (token === 'valid-token') {
      return HttpResponse.json({
        datasources: mockedDatasources.filter(ds => ds.name === 'Countries'),
      });
    }

    // Return unauthorized error for invalid token
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
  http.get('https://api.storyblok.com/v1/spaces/12345/datasource_entries', async ({ request }) => {
    const token = request.headers.get('Authorization');

    const url = new URL(request.url);
    const datasourceId = url.searchParams.get('datasource_id');

    // Return success response for valid token
    if (token === 'valid-token') {
      return HttpResponse.json({
        datasource_entries: mockedEntries[Number(datasourceId)],
      });
    }

    // Return unauthorized error for invalid token
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
  http.delete('https://api.storyblok.com/v1/spaces/12345/datasources/1', async ({ request }) => {
    const token = request.headers.get('Authorization');

    // Return success response for valid token
    if (token === 'valid-token') {
      return new HttpResponse(null, { status: 204 }); // 204 No Content is standard for DELETE
    }

    // Return unauthorized error for invalid token
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('delete datasources actions', () => {
  beforeEach(() => {
    // Reset and configure the MAPI client before each test
    mapiClient().dispose();
    mapiClient({
      token: 'valid-token',
      region: 'eu',
    });
  });

  describe('deleteDatasource', () => {
    it('should delete a datasource successfully', async () => {
      const result = await deleteDatasource('12345', '1');
      expect(result).toBeUndefined();
    });
    it('should throw an error if the datasource is not found by id', async () => {
      await expect(deleteDatasource('12345', 'Non-existent')).rejects.toThrow('Datasource with id \'Non-existent\' not found in space 12345.');
    });
  });

  describe('deleteDatasourceByName', () => {
    it('should delete a datasource by name successfully', async () => {
      const result = await deleteDatasourceByName('12345', 'Countries');
      expect(result).toBeUndefined();
    });
    it('should throw an error if the datasource is not found by name', async () => {
      await expect(deleteDatasourceByName('12345', 'Non-existent')).rejects.toThrow('Datasource with name \'Non-existent\' not found in space 12345.');
    });
  });
});
