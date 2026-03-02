import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiClient } from './index';

const openapiSpecPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../node_modules/@storyblok/openapi/dist/capi/datasource_entries.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('datasourceEntries.getAll()', () => {
  it('should successfully retrieve datasource entries', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.datasourceEntries.getAll();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.datasource_entries)).toBe(true);
  });

  it('should pass query parameters when filtering by datasource', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/datasource_entries', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({
          datasource_entries: [
            {
              id: 1,
              name: 'entry-one',
              value: 'value-one',
            },
          ],
          cv: 12345,
          _datasource: url.searchParams.get('datasource'),
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.datasourceEntries.getAll({ datasource: 'my-datasource' });

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.datasource_entries)).toBe(true);
    expect(result.data?.datasource_entries).toHaveLength(1);
    expect(result.data?.datasource_entries[0]?.name).toBe('entry-one');
  });

  it('should return error response on 401', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/datasource_entries', () => {
        return HttpResponse.json(
          {
            error: 'Unauthorized',
            message: 'Access token is invalid',
          },
          { status: 401 },
        );
      }),
    );
    const client = createApiClient({
      accessToken: 'invalid-token',
    });

    const result = await client.datasourceEntries.getAll();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });
});
