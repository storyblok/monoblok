import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fetchComponent, fetchComponentInternalTags, fetchComponents, saveComponentsToFiles } from './actions';
import { getMapiClient } from '../../../api';

const mockedComponents = [{
  name: 'component-name',
  display_name: 'Component Name',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 12345,
  schema: { type: 'object' },
  color: undefined,
  internal_tags_list: [{ id: 1, name: 'tag' }],
  internal_tag_ids: ['1'],
}, {
  name: 'component-name-2',
  display_name: 'Component Name 2',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 12346,
  schema: { type: 'object' },
  color: undefined,
  internal_tags_list: [{ id: 1, name: 'tag' }],
  internal_tag_ids: ['1'],
}, {
  name: 'name-2',
  display_name: 'Name 2',
  created_at: '2021-08-09T12:00:00Z',
  updated_at: '2021-08-09T12:00:00Z',
  id: 12346,
  schema: { type: 'object' },
  color: undefined,
  internal_tags_list: [],
  internal_tag_ids: [],
}];

const emptySpaceData = {
  groups: [],
  presets: [],
  internalTags: [],
  datasources: [],
};

const handlers = [
  http.get('https://mapi.storyblok.com/v1/spaces/12345/components', async ({ request }) => {
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

describe('pull components actions', () => {
  beforeEach(() => {
    getMapiClient({
      personalAccessToken: 'valid-token',
      region: 'eu',
    });
  });

  it('should pull components successfully with a valid token', async () => {
    const result = await fetchComponents('12345');
    expect(result).toEqual(mockedComponents);
  });

  it('should fetch all components across multiple pages', async () => {
    const totalComponents = 30;
    const allComponents = Array.from({ length: totalComponents }, (_, i) => ({
      name: `paged-${String(i + 1).padStart(2, '0')}`,
      display_name: `Paged ${i + 1}`,
      created_at: '2021-08-09T12:00:00Z',
      updated_at: '2021-08-09T12:00:00Z',
      id: 1000 + i,
      schema: { type: 'object' },
      color: undefined,
      internal_tags_list: [],
      internal_tag_ids: [],
    }));
    const requestedPages: number[] = [];

    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/12345/components', ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? '1');
        const perPage = Number(url.searchParams.get('per_page') ?? '25');
        requestedPages.push(page);
        const start = (page - 1) * perPage;
        const slice = allComponents.slice(start, start + perPage);
        return HttpResponse.json(
          { components: slice },
          { headers: { total: String(totalComponents) } },
        );
      }),
    );

    const result = await fetchComponents('12345');

    expect(result).toHaveLength(totalComponents);
    expect(result?.map(c => c.name)).toEqual(allComponents.map(c => c.name));
    expect(requestedPages).toEqual([1, 2]);
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
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
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
        color: undefined,
        internal_tags_list: [],
        internal_tag_ids: [],
      }],
    };
    // searching for 'name-2' would match both 'component-name-2' and 'name-2'
    const result = await fetchComponent('12345', 'name-2');
    expect(result).toEqual(mockResponse.components[0]);
  });

  describe('fetchComponentInternalTags', () => {
    it('should fetch all internal tags across multiple pages', async () => {
      const totalTags = 30;
      const allTags = Array.from({ length: totalTags }, (_, i) => ({
        id: i + 1,
        name: `tag-${String(i + 1).padStart(2, '0')}`,
        object_type: 'component',
      }));
      const requestedPages: number[] = [];
      const requestedObjectTypes: (string | null)[] = [];

      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/12345/internal_tags', ({ request }) => {
          const url = new URL(request.url);
          const page = Number(url.searchParams.get('page') ?? '1');
          const perPage = Number(url.searchParams.get('per_page') ?? '25');
          requestedPages.push(page);
          requestedObjectTypes.push(url.searchParams.get('by_object_type'));
          const start = (page - 1) * perPage;
          const slice = allTags.slice(start, start + perPage);
          return HttpResponse.json(
            { internal_tags: slice },
            { headers: { total: String(totalTags) } },
          );
        }),
      );

      const result = await fetchComponentInternalTags('12345');

      expect(result).toHaveLength(totalTags);
      expect(result?.map(t => t.name)).toEqual(allTags.map(t => t.name));
      expect(requestedPages).toEqual([1, 2]);
      expect(requestedObjectTypes.every(t => t === 'component')).toBe(true);
    });

    it('should return a single page when no total header is present', async () => {
      const tags = [
        { id: 1, name: 'only-tag', object_type: 'component' },
      ];

      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/12345/internal_tags', () =>
          HttpResponse.json({ internal_tags: tags })),
      );

      const result = await fetchComponentInternalTags('12345');

      expect(result).toEqual(tags);
    });
  });

  // TODO: Ask team regarding resseting the mapi client options
  /* it('should throw an masked error for invalid token', async () => {
    getMapiClient({
      token: {
        personalAccessToken: 'invalid-token',
      },
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
  }); */

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
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      }];

      await saveComponentsToFiles('12345', { components, ...emptySpaceData }, {
        path: '/path/to/',
        verbose: false,
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
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      }];

      await saveComponentsToFiles('12345', { components, ...emptySpaceData }, {
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
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      }];

      try {
        await saveComponentsToFiles('12345', { components, ...emptySpaceData }, {
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
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      }, {
        name: 'component-name-2',
        display_name: 'Component Name 2',
        created_at: '2021-08-09T12:00:00Z',
        updated_at: '2021-08-09T12:00:00Z',
        id: 12346,
        schema: { type: 'object' },
        color: undefined,
        internal_tags_list: [{ id: 1, name: 'tag' }],
        internal_tag_ids: ['1'],
      }];

      await saveComponentsToFiles('12345', { components, ...emptySpaceData }, {
        path: '/path/to4/',
        separateFiles: true,
        verbose: false,
      });

      const files = vol.readdirSync('/path/to4/components/12345');
      expect([...files].sort()).toEqual(['component-name-2.json', 'component-name.json', 'groups.json', 'tags.json'].sort());
    });
  });
});
