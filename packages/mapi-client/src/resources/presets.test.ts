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
  '../../node_modules/@storyblok/openapi/dist/mapi/presets.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('presets.list()', () => {
  it('should successfully retrieve multiple presets', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.presets.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.presets)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/presets', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'invalid-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.presets.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });

  it('should allow overriding space_id via path option', async () => {
    let resolvedSpaceId: string | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/:space_id/presets', ({ params }) => {
        resolvedSpaceId = String(params.space_id);
        return HttpResponse.json({ presets: [] });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.presets.list({ path: { space_id: 999 } });

    expect(result.error).toBeUndefined();
    expect(resolvedSpaceId).toBe('999');
  });
});

describe('presets.get()', () => {
  it('should successfully retrieve a single preset', async () => {
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.presets.get(456);

    expect(result.error).toBeUndefined();
    expect(typeof result.data?.preset).toBe('object');
  });
});

describe('presets.create()', () => {
  it('should successfully create a preset', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:space_id/presets', () => {
        return HttpResponse.json({
          preset: { id: 789, name: 'New Preset', component_id: 1 },
        }, { status: 201 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.presets.create({
      body: { preset: { name: 'New Preset', component_id: 1 } },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.preset).toBeDefined();
  });
});

describe('presets.remove()', () => {
  it('should successfully delete a preset', async () => {
    server.use(
      http.delete('https://mapi.storyblok.com/v1/spaces/:space_id/presets/:preset_id', () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );
    const client = createManagementApiClient({
      personalAccessToken: 'test-token',
      spaceId: 123,
      region: 'eu',
      rateLimit: false,
    });

    const result = await client.presets.remove(456);

    expect(result.error).toBeUndefined();
  });
});
