import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'pathe';
import { fileURLToPath } from 'node:url';
import { createManagementApiClient } from '../index';

const openapiSpecPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../node_modules/@storyblok/openapi/dist/mapi/assets.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('assets.list()', () => {
  it('should successfully retrieve multiple assets', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.assets)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ assets: [] });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.list({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});

describe('assets.convertToShared()', () => {
  it('should post to the convert endpoint with target_asset_folder_id and return the converted asset', async () => {
    let capturedUrl: string | undefined;
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id/convert', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          id: 42,
          filename: 'https://a.storyblok.com/g/99/500x500/shared.png',
        });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.convertToShared(42, {
      query: { target_asset_folder_id: 7 },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.filename).toContain('/g/99/');
    expect(capturedUrl).toContain('/v1/spaces/123/assets/42/convert');
    expect(capturedUrl).toContain('target_asset_folder_id=7');
  });
});

describe('assets.get()', () => {
  it('should successfully retrieve a single asset', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.get(456);

    expect(result.error).toBeUndefined();
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/assets/:asset_id', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assets.get(456);

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });
});
