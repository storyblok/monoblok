import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { createManagementApiClient } from './index';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());

describe('createManagementApiClient - region base URLs', () => {
  it.each([
    { region: 'eu' as const, expectedHost: 'mapi.storyblok.com' },
    { region: 'us' as const, expectedHost: 'api-us.storyblok.com' },
    { region: 'ap' as const, expectedHost: 'api-ap.storyblok.com' },
    { region: 'ca' as const, expectedHost: 'api-ca.storyblok.com' },
    { region: 'cn' as const, expectedHost: 'app.storyblokchina.cn' },
  ])('should use $expectedHost for region=$region', async ({ region, expectedHost }) => {
    let capturedUrl = '';
    server.use(
      http.get(`https://${expectedHost}/v1/spaces`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ spaces: [] });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region,
      rateLimit: false,
    });

    await client.spaces.list();

    expect(capturedUrl).toContain(expectedHost);
  });

  it('should use custom baseUrl when provided, ignoring region', async () => {
    let capturedUrl = '';
    server.use(
      http.get('https://custom.example.com/v1/spaces', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ spaces: [] });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      baseUrl: 'https://custom.example.com',
      rateLimit: false,
    });

    await client.spaces.list();

    expect(capturedUrl).toContain('custom.example.com');
  });
});

describe('createManagementApiClient - HTTP requests', () => {
  it('should retrieve spaces successfully', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', () => HttpResponse.json({ spaces: [{ id: 1, name: 'Test Space' }] })),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.spaces.list();

    expect(result.error).toBeUndefined();
    expect(result.data?.spaces).toHaveLength(1);
  });

  it('should retry 429 responses and eventually succeed', async () => {
    vi.useFakeTimers();

    let requestCount = 0;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', () => {
        requestCount++;
        if (requestCount <= 2) {
          return new HttpResponse(null, {
            status: 429,
            headers: { 'retry-after': '1' },
          });
        }
        return HttpResponse.json({ spaces: [] });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
      retry: { limit: 5, methods: ['get'], statusCodes: [429] },
    });

    const promise = client.spaces.list();
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(requestCount).toBeGreaterThanOrEqual(3);
    expect(result.data?.spaces).toBeDefined();
  });

  it('should send Authorization header for personalAccessToken', async () => {
    let capturedAuth = '';
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', ({ request }) => {
        capturedAuth = request.headers.get('authorization') ?? '';
        return HttpResponse.json({ spaces: [] });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'my-access-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    await client.spaces.list();

    expect(capturedAuth).toBe('my-access-token');
  });

  it('should send Bearer Authorization header for oauthToken', async () => {
    let capturedAuth = '';
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', ({ request }) => {
        capturedAuth = request.headers.get('authorization') ?? '';
        return HttpResponse.json({ spaces: [] });
      }),
    );

    const client = createManagementApiClient({
      oauthToken: 'my-oauth-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    await client.spaces.list();

    expect(capturedAuth).toBe('Bearer my-oauth-token');
  });

  it('should not double-prefix Bearer when oauthToken already includes it', async () => {
    let capturedAuth = '';
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', ({ request }) => {
        capturedAuth = request.headers.get('authorization') ?? '';
        return HttpResponse.json({ spaces: [] });
      }),
    );

    const client = createManagementApiClient({
      oauthToken: 'Bearer my-oauth-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    await client.spaces.list();

    expect(capturedAuth).toBe('Bearer my-oauth-token');
  });

  it('should keep each client instance independent', async () => {
    const requestsByToken: string[] = [];
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', ({ request }) => {
        requestsByToken.push(request.headers.get('authorization') ?? '');
        return HttpResponse.json({ spaces: [] });
      }),
    );

    const client1 = createManagementApiClient({ personalAccessToken: 'token-a', spaceId: 123, region: 'eu', rateLimit: false });
    const client2 = createManagementApiClient({ personalAccessToken: 'token-b', spaceId: 123, region: 'eu', rateLimit: false });

    await client1.spaces.list();
    await client2.spaces.list();

    expect(requestsByToken).toEqual(['token-a', 'token-b']);
  });
});

describe('createManagementApiClient - HTTP method helpers', () => {
  it('should send a GET request and return data', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/123/custom', () => HttpResponse.json({ result: 'ok' })),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.get<{ result: string }>('/v1/spaces/123/custom');

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ result: 'ok' });
  });

  it('should forward query params', async () => {
    let capturedUrl = '';
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/123/custom', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({});
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    await client.get('/v1/spaces/123/custom', { query: { page: 2 } });

    expect(capturedUrl).toContain('page=2');
  });

  it('should send a POST request with body', async () => {
    let capturedBody: unknown;
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/123/custom', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ created: true });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.post<{ created: boolean }>('/v1/spaces/123/custom', {
      body: { name: 'test' },
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ created: true });
    expect(capturedBody).toEqual({ name: 'test' });
  });

  it('should send a PUT request with body', async () => {
    let capturedBody: unknown;
    server.use(
      http.put('https://mapi.storyblok.com/v1/spaces/123/custom/1', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ updated: true });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.put<{ updated: boolean }>('/v1/spaces/123/custom/1', {
      body: { name: 'updated' },
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ updated: true });
    expect(capturedBody).toEqual({ name: 'updated' });
  });

  it('should send a PATCH request with body', async () => {
    let capturedBody: unknown;
    server.use(
      http.patch('https://mapi.storyblok.com/v1/spaces/123/custom/1', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ patched: true });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.patch<{ patched: boolean }>('/v1/spaces/123/custom/1', {
      body: { name: 'patched' },
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ patched: true });
    expect(capturedBody).toEqual({ name: 'patched' });
  });

  it('should send a DELETE request', async () => {
    let deleteCalled = false;
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/123/custom/1', () => {
        deleteCalled = true;
        return HttpResponse.json({});
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.delete('/v1/spaces/123/custom/1');

    expect(result.error).toBeUndefined();
    expect(deleteCalled).toBe(true);
  });

  it('should return error on non-2xx response', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/123/custom', () => HttpResponse.json({ error: 'Not Found' }, { status: 404 })),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.get('/v1/spaces/123/custom');

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(404);
  });
});

describe('createManagementApiClient - spaceId injection', () => {
  it('should inject spaceId from config into request path', async () => {
    let capturedUrl = '';
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/stories', ({ request }) => {
        capturedUrl = new URL(request.url).pathname;
        return HttpResponse.json({ stories: [] });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 42,
      rateLimit: false,
    });

    await client.stories.list();
    expect(capturedUrl).toBe('/v1/spaces/42/stories');
  });
});

describe('createManagementApiClient - rate limit slot', () => {
  it('should hold throttle slot during the request', async () => {
    vi.useFakeTimers();
    let concurrentRequests = 0;
    let maxConcurrent = 0;

    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', async () => {
        concurrentRequests++;
        maxConcurrent = Math.max(maxConcurrent, concurrentRequests);
        await new Promise(resolve => setTimeout(resolve, 100));
        concurrentRequests--;
        return HttpResponse.json({ spaces: [] });
      }),
    );

    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      rateLimit: 2,
    });

    // Fire 5 requests simultaneously
    const promises = Array.from({ length: 5 }, () => client.spaces.list());
    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});

describe('createManagementApiClient - throwOnError', () => {
  it('should return error in response when throwOnError is false (default)', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', () => {
        return HttpResponse.json(
          { error: 'Unauthorized' },
          { status: 401 },
        );
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.spaces.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should throw error when throwOnError is true', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', () => {
        return HttpResponse.json(
          { error: 'Unauthorized' },
          { status: 401 },
        );
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
      throwOnError: true,
    });

    await expect(client.spaces.list()).rejects.toThrow();
  });

  it('should allow overriding throwOnError per resource method call', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', () => {
        return HttpResponse.json(
          { error: 'Unauthorized' },
          { status: 401 },
        );
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    await expect(client.spaces.list({ throwOnError: true })).rejects.toThrow();
  });
});
