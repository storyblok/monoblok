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
  '../../node_modules/@storyblok/openapi/dist/mapi/datasource_entries.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('datasourceEntries.list()', () => {
  it('should successfully retrieve datasource entries', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.datasourceEntries.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.datasource_entries)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/datasource_entries', () => {
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

    const result = await client.datasourceEntries.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/datasource_entries', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ datasource_entries: [] });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.datasourceEntries.list({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});

describe('datasourceEntries.get()', () => {
  it('should successfully retrieve a single datasource entry', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.datasourceEntries.get(456);

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.datasource_entry).toBe('object');
  });
});

describe('datasourceEntries.update()', () => {
  it('should update a datasource entry', async () => {
    server.use(
      http.put('https://mapi.storyblok.com/v1/spaces/:space_id/datasource_entries/:datasource_entry_id', () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.datasourceEntries.update(456, {
      body: {
        datasource_entry: {
          name: 'Updated Entry',
          value: 'updated-value',
          datasource_id: 789,
        },
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.data).toBeNull();
  });
});
