import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'pathe';
import { fileURLToPath } from 'node:url';
import { createManagementApiClient } from '../index';

const openapiSpecPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../node_modules/@storyblok/openapi/dist/mapi/stories.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('stories.list()', () => {
  it('should successfully retrieve multiple stories', async () => {
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.stories.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.stories)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/stories', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.stories.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/stories', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ stories: [] });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.stories.list({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});

describe('stories.get()', () => {
  it('should successfully retrieve a single story', async () => {
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.stories.get(456);

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.story).toBe('object');
  });

  it('should return error in response when throwOnError is false (default)', async () => {
    vi.useFakeTimers();
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/stories/:story_id', () => {
        return HttpResponse.json(
          { error: 'Not Found' },
          { status: 404 },
        );
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const resultPromise = client.stories.get(999);
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(404);
    vi.useRealTimers();
  });

  it('should throw error when throwOnError is true', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/stories/:story_id', () => {
        return HttpResponse.json(
          { error: 'Not Found' },
          { status: 404 },
        );
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
      throwOnError: true,
    });

    await expect(client.stories.get(999)).rejects.toThrow();
  });
});

describe('stories.create()', () => {
  it('should create a story', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/stories', () => {
        return HttpResponse.json({
          story: { id: 789, name: 'New Story', slug: 'new-story' },
        }, { status: 201 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.stories.create({
      body: {
        story: {
          name: 'New Story',
          slug: 'new-story',
          content: { _uid: 'uid-1', component: 'page' },
        },
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.story).toBeDefined();
  });
});

describe('stories.update()', () => {
  it('should update a story', async () => {
    server.use(
      http.put('https://mapi.storyblok.com/v1/spaces/:space_id/stories/:story_id', () => {
        return HttpResponse.json({
          story: { id: 456, name: 'Updated Story', slug: 'updated-story' },
        });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.stories.update(456, { body: { story: { name: 'Updated Story' } } });

    expect(result.error).toBeUndefined();
    expect(result.data?.story).toBeDefined();
  });
});

describe('stories.remove()', () => {
  it('should delete a story', async () => {
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/:space_id/stories/:story_id', () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.stories.remove(456);

    expect(result.error).toBeUndefined();
  });
});
