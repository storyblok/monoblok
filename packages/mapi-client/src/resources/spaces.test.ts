import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createManagementApiClient } from '../index';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('spaces.list()', () => {
  it('should successfully retrieve multiple spaces', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', () => {
        return HttpResponse.json({ spaces: [] });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.spaces.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.spaces)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
});

describe('spaces.get()', () => {
  it('should successfully retrieve the current space', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id', () => {
        return HttpResponse.json({ space: { id: 123, name: 'Space' } });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.spaces.get();

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.space).toBe('object');
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.spaces.get();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({
          space: { id: Number(params.space_id), name: 'Space' },
        });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.spaces.get({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});
