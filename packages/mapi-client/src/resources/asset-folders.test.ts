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
  '../../node_modules/@storyblok/openapi/dist/mapi/asset_folders.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('assetFolders.list()', () => {
  it('should successfully retrieve multiple asset folders', async () => {
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assetFolders.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.asset_folders)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/asset_folders', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assetFolders.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/asset_folders', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ asset_folders: [] });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assetFolders.list({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});

describe('assetFolders.get()', () => {
  it('should successfully retrieve a single asset folder', async () => {
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assetFolders.get(456);

    expect(result.error).toBeUndefined();
  });
});

describe('assetFolders.create()', () => {
  it('should successfully create an asset folder', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/asset_folders', () => {
        return HttpResponse.json({
          asset_folder: { id: 789, name: 'New Folder', uuid: 'uuid-1' },
        }, { status: 201 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assetFolders.create({
      body: { asset_folder: { name: 'New Folder' } },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.asset_folder).toBeDefined();
  });
});

describe('assetFolders.remove()', () => {
  it('should successfully delete an asset folder', async () => {
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/:space_id/asset_folders/:asset_folder_id', () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.assetFolders.remove(456);

    expect(result.error).toBeUndefined();
  });
});
