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
  '../node_modules/@storyblok/openapi/dist/capi/tags.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('tags.getAll()', () => {
  it('should return tags array', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.tags.getAll();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.tags)).toBe(true);
  });

  it('should pass starts_with query param', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/tags', ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const startsWith = url.searchParams.get('starts_with');
        return HttpResponse.json({
          tags: startsWith
            ? [{ name: `${startsWith}-tag`, taggings_count: 3 }]
            : [],
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.tags.getAll({ starts_with: 'blog' });

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.tags)).toBe(true);
    expect(result.data?.tags[0]?.name).toBe('blog-tag');
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/tags', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: 'invalid-token',
    });

    const result = await client.tags.getAll();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });
});
