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

    const result = await client.stories.get('non-existent-story');

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(404);
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

  it('should append cv when cache.setCv() was called', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          cv: url.searchParams.get('cv'),
        });
      }),
    );

    const client = createApiClient({
      accessToken: 'test-token',
    });

    client.cache.setCv(4242);
    const result = await client.get<{ cv: string | null }>('v2/cdn/links', {
      query: { version: 'published' },
    });

    expect(result.data?.cv).toBe('4242');
    expect(client.cache.getCv()).toBe(4242);
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

  it('should return stale response and revalidate in background with swr strategy', async () => {
    vi.useFakeTimers();
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
        ttlMs: 100,
      },
    });

    const firstResult = await client.get<{ requestCount: number }>('v2/cdn/links', {
      query: { version: 'published' },
    });

    await vi.advanceTimersByTimeAsync(120);

    const secondResult = await client.get<{ requestCount: number }>('v2/cdn/links', {
      query: { version: 'published' },
    });

    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    const thirdResult = await client.get<{ requestCount: number }>('v2/cdn/links', {
      query: { version: 'published' },
    });

    expect(firstResult.data?.requestCount).toBe(1);
    expect(secondResult.data?.requestCount).toBe(1);
    expect(thirdResult.data?.requestCount).toBe(2);
    vi.useRealTimers();
  });
});
