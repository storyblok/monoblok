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
  '../node_modules/@storyblok/openapi/dist/capi/spaces.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('spaces.get()', () => {
  it('should successfully retrieve the current space', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.spaces.get();

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.space).toBe('object');
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/spaces/me', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: 'invalid-token',
    });

    const result = await client.spaces.get();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should always hit the network (not cached)', async () => {
    let requestCount = 0;
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/spaces/me', () => {
        requestCount++;
        return HttpResponse.json({
          space: {
            id: 1,
            name: 'Test Space',
            domain: 'https://test.storyblok.com',
            version: 1,
            language_codes: [],
          },
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    await client.spaces.get();
    await client.spaces.get();

    expect(requestCount).toBe(2);
  });
});
