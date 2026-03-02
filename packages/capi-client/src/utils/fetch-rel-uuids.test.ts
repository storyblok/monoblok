import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { type Client, createClient, createConfig } from '../generated/stories/client';
import { createThrottleManager } from '../rate-limit';
import { fetchMissingRelations } from './fetch-rel-uuids';

// Passthrough throttle — no queuing overhead for most unit tests.
const passthroughThrottleManager = createThrottleManager(false);

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

const createTestClient = (): Client => {
  return createClient(createConfig({
    auth: 'test-token',
    baseUrl: 'https://api.storyblok.com',
  }));
};

describe('fetchMissingRelations', () => {
  it('should fetch chunks with request query context', async () => {
    const requestedByUuids: string[] = [];
    const seenLanguage: string[] = [];
    const startsWith: Array<string | null> = [];

    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const byUuids = url.searchParams.get('by_uuids') ?? '';
        requestedByUuids.push(byUuids);
        seenLanguage.push(url.searchParams.get('language') ?? '');
        startsWith.push(url.searchParams.get('starts_with'));

        return HttpResponse.json({
          stories: byUuids.split(',').map(uuid => ({ uuid })),
        });
      }),
    );

    const stories = await fetchMissingRelations({
      baseQuery: {
        language: 'de',
        starts_with: 'blog/',
        version: 'draft',
      },
      client: createTestClient(),
      throttleManager: passthroughThrottleManager,
      uuids: ['a', 'b', 'a'],
    });

    expect(requestedByUuids).toEqual(['a,b,a']);
    expect(seenLanguage).toEqual(['de']);
    expect(startsWith).toEqual([null]);
    expect(stories.map(story => story.uuid)).toEqual(['a', 'b', 'a']);
  });

  it('should respect the throttle manager concurrency limit', async () => {
    vi.useFakeTimers();

    // Limit to 2 concurrent requests so we can verify the throttle is honoured.
    const limitedThrottleManager = createThrottleManager(2);
    const uuids = Array.from({ length: 150 }, (_, index) => `uuid-${index}`); // 3 chunks
    let activeRequests = 0;
    let maxActiveRequests = 0;
    let requestCount = 0;

    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories', async ({ request }: { request: Request }) => {
        requestCount++;
        activeRequests++;
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

        await new Promise(resolve => setTimeout(resolve, 10));

        activeRequests--;
        const url = new URL(request.url);
        const byUuids = url.searchParams.get('by_uuids') ?? '';

        return HttpResponse.json({
          stories: byUuids.split(',').map(uuid => ({ uuid })),
        });
      }),
    );

    const promise = fetchMissingRelations({
      baseQuery: {},
      client: createTestClient(),
      throttleManager: limitedThrottleManager,
      uuids,
    });

    await vi.runAllTimersAsync();
    await promise;

    expect(requestCount).toBe(3);
    expect(maxActiveRequests).toBeLessThanOrEqual(2);
  });

  it('should send per_page equal to chunk size to avoid silent truncation', async () => {
    const seenPerPage: Array<string | null> = [];

    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        seenPerPage.push(url.searchParams.get('per_page'));
        const byUuids = url.searchParams.get('by_uuids') ?? '';
        return HttpResponse.json({
          stories: byUuids.split(',').map(uuid => ({ uuid })),
        });
      }),
    );

    await fetchMissingRelations({
      baseQuery: {},
      client: createTestClient(),
      throttleManager: passthroughThrottleManager,
      uuids: ['a', 'b'],
    });

    expect(seenPerPage).toEqual(['50']);
  });

  it('should throw when one relation chunk fails', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/stories', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const byUuids = url.searchParams.get('by_uuids') ?? '';

        if (byUuids.includes('bad')) {
          return HttpResponse.json({ message: 'boom' }, { status: 500 });
        }

        return HttpResponse.json({ stories: [{ uuid: 'ok' }] });
      }),
    );

    await expect(fetchMissingRelations({
      baseQuery: {},
      client: createTestClient(),
      throttleManager: passthroughThrottleManager,
      uuids: ['bad'],
    })).rejects.toBeDefined();
  });
});
