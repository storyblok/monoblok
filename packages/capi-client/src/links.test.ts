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
  '../node_modules/@storyblok/openapi/dist/capi/links.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('links.getAll()', () => {
  it('should successfully retrieve multiple links', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.links.getAll();

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.links).toBe('object');
  });

  it('should return links as a record of link objects', async () => {
    const linkUuid = 'abc-123';
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', () => {
        return HttpResponse.json({
          links: {
            [linkUuid]: {
              id: 1,
              uuid: linkUuid,
              slug: 'home',
              path: '',
              name: 'Home',
              is_folder: false,
              published: true,
              is_startpage: true,
              position: 0,
              real_path: '/home',
            },
          },
          cv: 1,
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.links.getAll();

    expect(result.error).toBeUndefined();
    expect(result.data?.links[linkUuid]).toBeDefined();
    expect(result.data?.links[linkUuid]?.uuid).toBe(linkUuid);
    expect(result.data?.links[linkUuid]?.slug).toBe('home');
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', () => {
        return HttpResponse.json(
          { error: 'Unauthorized' },
          { status: 401 },
        );
      }),
    );
    const client = createApiClient({
      accessToken: 'invalid-token',
    });

    const result = await client.links.getAll();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should use in-memory cache for second call', async () => {
    let requestCount = 0;
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', () => {
        requestCount++;
        return HttpResponse.json({
          links: {},
          cv: 1,
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    await client.links.getAll({ version: 'published' });
    await client.links.getAll({ version: 'published' });

    expect(requestCount).toBe(1);
  });

  it('should not cache draft requests', async () => {
    let requestCount = 0;
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/links', () => {
        requestCount++;
        return HttpResponse.json({ links: {} });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    await client.links.getAll({ version: 'draft' });
    await client.links.getAll({ version: 'draft' });

    expect(requestCount).toBe(2);
  });
});
