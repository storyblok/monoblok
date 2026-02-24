import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiClient } from './index';

const openapiSpecPath = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../node_modules/@storyblok/openapi/dist/capi/datasources.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('datasources.getAll()', () => {
  it('should successfully retrieve multiple datasources', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.datasources.getAll();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.datasources)).toBe(true);
  });

  it('should return error on 401', async () => {
    vi.useFakeTimers();
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/datasources', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: 'invalid-token',
    });

    const resultPromise = client.datasources.getAll();
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
    vi.useRealTimers();
  });
});

describe('datasources.get()', () => {
  it('should successfully retrieve a single datasource', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.datasources.get(123);

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.datasource).toBe('object');
  });

  it('should return error on 401', async () => {
    vi.useFakeTimers();
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/datasources/*', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: 'invalid-token',
    });

    const resultPromise = client.datasources.get(123);
    await vi.runOnlyPendingTimersAsync();
    const result = await resultPromise;

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
    vi.useRealTimers();
  });
});
