import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { type Client, createClient, createConfig } from '../generated/client';
import { fetchMissingRelations } from './fetch-rel-uuids';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
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
      uuids: ['a', 'b', 'a'],
    });

    expect(requestedByUuids).toEqual(['a,b,a']);
    expect(seenLanguage).toEqual(['de']);
    expect(startsWith).toEqual([null]);
    expect(stories.map(story => story.uuid)).toEqual(['a', 'b', 'a']);
  });

  it('should limit fetch concurrency to current chunk count when below max concurrency', async () => {
    const uuids = Array.from({ length: 160 }, (_, index) => `uuid-${index}`);
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

    await fetchMissingRelations({
      baseQuery: {},
      client: createTestClient(),
      uuids,
    });

    expect(requestCount).toBe(4);
    expect(maxActiveRequests).toBeLessThanOrEqual(4);
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
      uuids: ['bad'],
    })).rejects.toBeDefined();
  });
});
