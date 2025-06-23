import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fetchComponent, fetchComponents, saveComponentsToFiles } from './actions';
import { mapiClient } from '../../../api';

const mockedComponents = [{
  name: 'component-name',
  display_name: 'Component Name',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 12345,
  schema: { type: 'object' },
  color: null,
  internal_tags_list: ['tag'],
  internal_tag_ids: [1],
}, {
  name: 'component-name-2',
  display_name: 'Component Name 2',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 12346,
  schema: { type: 'object' },
  color: null,
  internal_tags_list: ['tag'],
  internal_tag_ids: [1],
}, {
  name: 'name-2',
  display_name: 'Name 2',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 12346,
  schema: { type: 'object' },
  color: null,
  internal_tags_list: [],
  internal_tag_ids: [],
}];

const handlers = [
  http.get('https://api.storyblok.com/v1/spaces/12345/components', async ({ request }) => {
    const token = request.headers.get('Authorization');
    if (token === 'valid-token') {
      return HttpResponse.json({
        components: mockedComponents,
      });
    }
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('pull components actions', () => {
  beforeEach(() => {
    mapiClient().dispose();
    mapiClient({
      token: 'valid-token',
      region: 'eu',
    });
  });

  it('should pull components successfully with a valid token', async () => {
    const mockResponse = [{
      name: 'component-name',
      display_name: 'Component Name',
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
      id: 12345,
      schema: { type: 'object' },
      color: null,
      internal_tags_list: ['tag'],
      internal_tag_ids: [1],
    }, {
      name: 'component-name-2',
      display_name: 'Component Name 2',
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
      id: 12346,
      schema: { type: 'object' },
      color: null,
      internal_tags_list: ['tag'],
      internal_tag_ids: [1],
    }, {
      name: 'name-2',
      display_name: 'Name 2',
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
      id: 12346,
      schema: { type: 'object' },
      color: null,
      internal_tags_list: [],
      internal_tag_ids: [],
    }];

    const result = await fetchComponents('12345');
    expect(result).toEqual(mockResponse);
  });

  it('should fetch a component by name', async () => {
    const mockResponse = {
      components: [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: ['tag'],
        internal_tag_ids: [1],
      }],
    };
    const result = await fetchComponent('12345', 'component-name');
    expect(result).toEqual(mockResponse.components[0]);
  });

  it('should choose the right component when multiple names match', async () => {
    const mockResponse = {
      components: [{
        name: 'name-2',
        display_name: 'Name 2',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12346,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: [],
        internal_tag_ids: [],
      }],
    };
    // searching for 'name-2' would match both 'component-name-2' and 'name-2'
    const result = await fetchComponent('12345', 'name-2');
    expect(result).toEqual(mockResponse.components[0]);
  });

  it('should throw an masked error for invalid token', async () => {
    mapiClient().dispose();
    mapiClient({
      token: 'invalid-token',
      region: 'eu',
    });

    await expect(fetchComponents('12345')).rejects.toThrow(
      expect.objectContaining({
        name: 'API Error',
        message: 'The user is not authorized to access the API',
        cause: 'The user is not authorized to access the API',
        errorId: 'unauthorized',
        code: 401,
        messageStack: [
          'Failed to pull components',
          'The user is not authorized to access the API',
        ],
      }),
    );
  });

  describe('saveComponentsToFiles', () => {
    it('should save components to files successfully', async () => {
      vol.fromJSON({
        '/path/to/components/12345': null,
      });

      const components = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: ['tag'],
        internal_tag_ids: [1],
      }];

      await saveComponentsToFiles('12345', { components }, {
        path: '/path/to/',
        verbose: false,
        space: '12345',
      });

      const files = vol.readdirSync('/path/to/components/12345');
      expect(files).toEqual(['components.json']);
    });

    it('should save components to files with custom filename', async () => {
      vol.fromJSON({
        '/path/to2/': null,
      });

      const components = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: ['tag'],
        internal_tag_ids: [1],
      }];

      await saveComponentsToFiles('12345', { components }, {
        path: '/path/to2/',
        filename: 'custom',
        verbose: false,
      });

      const files = vol.readdirSync('/path/to2/components/12345');
      expect(files).toEqual(['custom.json']);
    });

    it('should save components to files with custom suffix', async () => {
      vol.fromJSON({
        '/path/to3/': null,
      });

      const components = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: ['tag'],
        internal_tag_ids: [1],
      }];

      try {
        await saveComponentsToFiles('12345', { components }, {
          path: '/path/to3/',
          suffix: 'custom',
          verbose: false,
        });
      }
      catch (error) {
        console.log('TEST', error);
      }

      const files = vol.readdirSync('/path/to3/components/12345');
      expect(files).toEqual(['components.custom.json']);
    });

    it('should save components to separate files', async () => {
      vol.fromJSON({
        '/path/to4/': null,
      });

      const components = [{
        name: 'component-name',
        display_name: 'Component Name',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12345,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: ['tag'],
        internal_tag_ids: [1],
      }, {
        name: 'component-name-2',
        display_name: 'Component Name 2',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12346,
        schema: { type: 'object' },
        color: null,
        internal_tags_list: ['tag'],
        internal_tag_ids: [1],
      }];

      await saveComponentsToFiles('12345', { components }, {
        path: '/path/to4/',
        separateFiles: true,
        verbose: false,
      });

      const files = vol.readdirSync('/path/to4/components/12345');
      expect(files).toEqual(['component-name-2.json', 'component-name.json', 'groups.json', 'tags.json']);
    });
  });
});
