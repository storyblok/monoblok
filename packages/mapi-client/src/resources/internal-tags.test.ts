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
  '../../node_modules/@storyblok/openapi/dist/mapi/internal_tags.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('internalTags.getAll()', () => {
  it('should successfully retrieve multiple internal tags', async () => {
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.internalTags.getAll();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.internal_tags)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/internal_tags', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.internalTags.getAll();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/internal_tags', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ internal_tags: [] });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.internalTags.getAll({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});

describe('internalTags.create()', () => {
  it('should successfully create an internal tag', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/internal_tags', () => {
        return HttpResponse.json({
          internal_tag: { id: 1, name: 'New Tag', object_type: 'asset' },
        }, { status: 201 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.internalTags.create({ body: { name: 'New Tag', object_type: 'asset' } });

    expect(result.error).toBeUndefined();
    expect(result.data?.internal_tag).toBeDefined();
  });
});

describe('internalTags.remove()', () => {
  it('should successfully delete an internal tag', async () => {
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/:space_id/internal_tags/:internal_tag_id', () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const client = createManagementApiClient({
      accessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.internalTags.remove(1);

    expect(result.error).toBeUndefined();
  });
});
