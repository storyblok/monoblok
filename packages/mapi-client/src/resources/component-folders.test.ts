import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createManagementApiClient } from '../index';

const openapiSpecPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../node_modules/@storyblok/openapi/dist/mapi/component_folders.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('componentFolders.getAll()', () => {
  it('should successfully retrieve multiple component folders', async () => {
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.componentFolders.getAll();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.component_groups)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/component_groups', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.componentFolders.getAll();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/component_groups', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ component_groups: [] });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.componentFolders.getAll({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});

describe('componentFolders.get()', () => {
  it('should successfully retrieve a single component folder', async () => {
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.componentFolders.get(456);

    expect(result.error).toBeUndefined();
    expect(result.data?.component_group).toBeDefined();
  });
});

describe('componentFolders.create()', () => {
  it('should successfully create a component folder', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/component_groups', () => {
        return HttpResponse.json({
          component_group: { id: 789, name: 'New Folder', uuid: 'uuid-1' },
        }, { status: 201 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.componentFolders.create({
      body: { component_group: { name: 'New Folder' } },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.component_group).toBeDefined();
  });
});

describe('componentFolders.remove()', () => {
  it('should successfully delete a component folder', async () => {
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/:space_id/component_groups/:component_group_id', () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.componentFolders.remove(456);

    expect(result.error).toBeUndefined();
  });
});
