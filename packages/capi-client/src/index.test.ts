import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApiClient } from './index';

const openapiSpecPath = join(
  __dirname,
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
