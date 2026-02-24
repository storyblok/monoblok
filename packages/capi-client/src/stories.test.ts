import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiClient } from './index';

const openapiSpecPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../node_modules/@storyblok/openapi/dist/capi/stories.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const makeStory = (uuid: string, content: Record<string, unknown>) => {
  return {
    alternates: [],
    content,
    created_at: '2024-01-01T00:00:00.000Z',
    default_full_slug: `default/${uuid}`,
    first_published_at: '2024-01-01T00:00:00.000Z',
    full_slug: `stories/${uuid}`,
    group_id: `group-${uuid}`,
    id: Number.parseInt(uuid.replace(/\D/g, ''), 10) || 1,
    is_startpage: false,
    lang: 'default',
    localized_paths: [],
    name: `Story ${uuid}`,
    parent_id: 0,
    path: `stories/${uuid}`,
    position: 0,
    published_at: '2024-01-01T00:00:00.000Z',
    release_id: 0,
    slug: uuid,
    sort_by_date: '2024-01-01',
    tag_list: [],
    translated_slugs: [],
    updated_at: '2024-01-01T00:00:00.000Z',
    uuid,
  };
};

describe('stories.get()', () => {
  it('should successfully retrieve a single story', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.stories.get('test-story');

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.story).toBe('object');
  });

  it('should retry on 429', async () => {
    vi.useFakeTimers();
    let requestCount = 0;
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories/*', async () => {
        requestCount++;
        if (requestCount === 1) {
          return new HttpResponse(null, {
            status: 429,
          });
        }

        return HttpResponse.json({
          story: {
            id: 123,
            name: 'test-story',
            slug: 'test-story',
            full_slug: 'test-story',
            created_at: '2024-01-01T00:00:00.000Z',
            published_at: '2024-01-01T00:00:00.000Z',
            content: {},
          },
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const resultPromise = client.stories.get('test-story');
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.story).toBe('object');
    expect(requestCount).toBe(2);
    vi.useRealTimers();
  });

  it('should return error in response when throwOnError is false (default)', async () => {
    vi.useFakeTimers();
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories/*', () => {
        return HttpResponse.json(
          {
            error: 'Not Found',
            message: 'Story not found',
          },
          { status: 404 },
        );
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const resultPromise = client.stories.get('non-existent-story');
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(404);
    vi.useRealTimers();
  });

  it('should throw error when throwOnError is true', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories/*', () => {
        return HttpResponse.json(
          {
            error: 'Not Found',
            message: 'Story not found',
          },
          { status: 404 },
        );
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
      throwOnError: true,
    });

    await expect(client.stories.get('non-existent-story')).rejects.toThrow();
  });
});

describe('stories.getAll()', () => {
  it('should successfully retrieve multiple stories', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.stories.getAll();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.stories)).toBe(true);
  });
});

describe('inlineRelations', () => {
  it('should keep default behavior when inlineRelations is false', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories/*', () => {
        return HttpResponse.json({
          rels: [
            makeStory('author-1', {
              _uid: 'author-content-1',
              component: 'author',
              name: 'Ada',
            }),
          ],
          story: makeStory('page-1', {
            _uid: 'page-content-1',
            author: 'author-1',
            component: 'page',
          }),
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.stories.get('test-story', {
      resolve_relations: 'page.author',
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.story.content.author).toBe('author-1');
  });

  it('should inline relations for stories.get()', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories/*', () => {
        return HttpResponse.json({
          rels: [
            makeStory('author-1', {
              _uid: 'author-content-1',
              component: 'author',
              name: 'Pat',
            }),
            makeStory('article-1', {
              _uid: 'article-content-1',
              component: 'article',
              title: 'Foo',
            }),
            makeStory('article-2', {
              _uid: 'article-content-2',
              component: 'article',
              title: 'Bar',
            }),
          ],
          story: makeStory('page-1', {
            _uid: 'page-content-1',
            author: 'author-1',
            articles: [
              'article-1',
            ],
            teaser: [
              {
                _uid: 'teaser-content-1',
                component: 'teaser',
                articles: [
                  'article-2',
                ],
              },
            ],
            component: 'page',
          }),
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    });

    const result = await client.stories.get('test-story', {
      resolve_relations: 'page.author,page.articles,teaser.articles',
    });

    expect(result.error).toBeUndefined();
    const content = result.data?.story.content;
    expect(content?.author).toMatchObject({ uuid: 'author-1' });
    expect(content?.articles).toMatchObject([{ uuid: 'article-1' }]);
    // @ts-expect-error dynamically typed
    expect(content?.teaser?.[0].articles).toMatchObject([{ uuid: 'article-2' }]);
  });

  it('should auto-fetch rel_uuids and inline fetched stories', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories/*', () => {
        return HttpResponse.json({
          rel_uuids: ['author-1'],
          story: makeStory('page-1', {
            _uid: 'page-content-1',
            author: 'author-1',
            component: 'page',
          }),
        });
      }),
      http.get('https://api.storyblok.com/v2/cdn/stories', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('by_uuids') === 'author-1') {
          return HttpResponse.json({
            stories: [
              makeStory('author-1', {
                _uid: 'author-content-1',
                component: 'author',
                name: 'Kai',
              }),
            ],
          });
        }

        return HttpResponse.json({ stories: [] });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    });

    const result = await client.stories.get('test-story', {
      resolve_relations: 'page.author',
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.story.content.author).toMatchObject({ uuid: 'author-1' });
  });

  it('should throw when relation fetching fails', async () => {
    vi.useFakeTimers();
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories/*', () => {
        return HttpResponse.json({
          rel_uuids: ['author-throw'],
          story: makeStory('page-throw', {
            _uid: 'page-content-throw',
            author: 'author-throw',
            component: 'page',
          }),
        });
      }),
      http.get('https://api.storyblok.com/v2/cdn/stories', () => {
        return HttpResponse.json({ message: 'Nope' }, { status: 500 });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    });

    await expect(async () => {
      const resultPromise = client.stories.get('test-story', {
        resolve_relations: 'page.author',
      });
      await Promise.all([resultPromise, vi.runAllTimersAsync()]);
    }).rejects.toThrow();
    vi.useRealTimers();
  });

  it('should merge inline relations from rels and rel_uuids for stories.getAll()', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const byUuids = url.searchParams.get('by_uuids');

        if (byUuids) {
          return HttpResponse.json({
            stories: [
              makeStory('author-1', {
                _uid: 'author-content-1',
                component: 'author',
                name: 'Lee',
              }),
            ],
          });
        }

        return HttpResponse.json({
          rel_uuids: ['author-1'],
          rels: [
            makeStory('author-2', {
              _uid: 'author-content-2',
              component: 'author',
              name: 'Sam',
            }),
          ],
          stories: [
            makeStory('page-1', {
              _uid: 'page-content-1',
              authors: ['author-1', 'author-2'],
              component: 'page',
            }),
          ],
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
      inlineRelations: true,
    });

    const result = await client.stories.getAll({
      resolve_relations: 'page.authors',
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.stories[0]?.content.authors).toMatchObject([
      { uuid: 'author-1' },
      { uuid: 'author-2' },
    ]);
    expect(result.data?.rels).toHaveLength(1);
    expect(result.data?.rel_uuids).toEqual(['author-1']);
  });
});

describe('generic HTTP methods', () => {
  it('should perform GET requests with query params', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          query: {
            starts_with: url.searchParams.get('starts_with'),
            token: url.searchParams.get('token'),
            version: url.searchParams.get('version'),
          },
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.get<{
      query: { starts_with: string | null; token: string | null; version: string | null };
    }>('v2/cdn/links', {
      query: {
        starts_with: 'docs/',
        version: 'published',
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.query).toEqual({
      starts_with: 'docs/',
      token: 'test-token',
      version: 'published',
    });
  });

  it('should perform POST requests with body', async () => {
    server.use(
      http.post('https://api.storyblok.com/v2/cdn/custom-endpoint', async ({ request }: { request: Request }) => {
        const body = await request.json();
        return HttpResponse.json({
          method: request.method,
          body,
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.post<{ method: string; body: unknown }>('v2/cdn/custom-endpoint', {
      body: {
        title: 'hello',
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      method: 'POST',
      body: {
        title: 'hello',
      },
    });
  });

  it('should perform PUT, PATCH and DELETE requests', async () => {
    server.use(
      http.put('https://api.storyblok.com/v2/cdn/custom-endpoint', () => {
        return HttpResponse.json({ method: 'PUT' });
      }),
      http.patch('https://api.storyblok.com/v2/cdn/custom-endpoint', () => {
        return HttpResponse.json({ method: 'PATCH' });
      }),
      http.delete('https://api.storyblok.com/v2/cdn/custom-endpoint', () => {
        return HttpResponse.json({ method: 'DELETE' });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const putResult = await client.put<{ method: string }>('v2/cdn/custom-endpoint');
    const patchResult = await client.patch<{ method: string }>('v2/cdn/custom-endpoint');
    const deleteResult = await client.delete<{ method: string }>('v2/cdn/custom-endpoint');

    expect(putResult.data?.method).toBe('PUT');
    expect(patchResult.data?.method).toBe('PATCH');
    expect(deleteResult.data?.method).toBe('DELETE');
  });

  it('should return error when throwOnError is false', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/custom-endpoint', () => {
        return HttpResponse.json({ message: 'Nope' }, { status: 404 });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.get('v2/cdn/custom-endpoint');

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(404);
  });

  it('should throw error when throwOnError is true', async () => {
    server.use(
      http.patch('https://api.storyblok.com/v2/cdn/custom-endpoint', () => {
        return HttpResponse.json({ message: 'Nope' }, { status: 404 });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
      throwOnError: true,
    });

    await expect(client.patch('v2/cdn/custom-endpoint')).rejects.toThrow();
  });
});

describe('cache and cv', () => {
  it('should use in-memory cache by default for published CDN GET requests', async () => {
    let requestCount = 0;
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', () => {
        requestCount++;
        return HttpResponse.json({
          links: {},
          cv: 1,
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    await client.get('v2/cdn/links', {
      query: { version: 'published' },
    });
    await client.get('v2/cdn/links', {
      query: { version: 'published' },
    });

    expect(requestCount).toBe(1);
  });

  it('should not cache draft requests', async () => {
    let requestCount = 0;
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', () => {
        requestCount++;
        return HttpResponse.json({ links: {} });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    await client.get('v2/cdn/links', {
      query: { version: 'draft' },
    });
    await client.get('v2/cdn/links', {
      query: { version: 'draft' },
    });

    expect(requestCount).toBe(2);
  });

  it('should flush cache when cv changes', async () => {
    let requestCount = 0;
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', ({ request }: { request: Request }) => {
        requestCount++;
        const url = new URL(request.url);
        const page = url.searchParams.get('page');

        if (page === '2') {
          return HttpResponse.json({ links: {}, cv: 2 });
        }

        return HttpResponse.json({ links: {}, cv: 1 });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    await client.get('v2/cdn/links', {
      query: { version: 'published', page: 1 },
    });
    await client.get('v2/cdn/links', {
      query: { version: 'published', page: 1 },
    });
    await client.get('v2/cdn/links', {
      query: { version: 'published', page: 2 },
    });
    await client.get('v2/cdn/links', {
      query: { version: 'published', page: 1 },
    });

    expect(requestCount).toBe(3);
  });

  it('should return cached response and revalidate in background with swr strategy', async () => {
    let requestCount = 0;
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', () => {
        requestCount++;
        return HttpResponse.json({
          requestCount,
          links: {},
          cv: 1,
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
      cache: {
        strategy: 'swr',
        ttlMs: 1_000,
      },
    });

    const firstResult = await client.get<{ requestCount: number }>('v2/cdn/links', {
      query: { version: 'published' },
    });
    const secondResult = await client.get<{ requestCount: number }>('v2/cdn/links', {
      query: { version: 'published' },
    });
    await vi.waitFor(() => {
      expect(requestCount).toBe(2);
    });
    const thirdResult = await client.get<{ requestCount: number }>('v2/cdn/links', {
      query: { version: 'published' },
    });

    expect(firstResult.data?.requestCount).toBe(1);
    expect(secondResult.data?.requestCount).toBe(1);
    expect(thirdResult.data?.requestCount).toBe(2);
  });
});
