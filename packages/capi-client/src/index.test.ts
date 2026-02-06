import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { fromOpenApi } from '@msw/source/open-api';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createApiClient } from './index';

const openapiSpecPath = join(
  __dirname,
  '../node_modules/@storyblok/openapi/dist/capi/stories.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('stories.get()', () => {
  it('should successfully retrieve a single story', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.stories.get('test-story');

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.story).toBe('object');
  });
});

describe('stories.getAll()', () => {
  it('should successfully retrieve multiple stories', async () => {
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.stories.getAll();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.stories)).toBe(true);
  });
});
