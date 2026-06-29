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
  '../../node_modules/@storyblok/openapi/dist/mapi/experiments.yaml',
);
const openapiSpec = readFileSync(openapiSpecPath, 'utf-8');
const handlers = await fromOpenApi(openapiSpec);
const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const createClient = (token = 'test-token') =>
  createManagementApiClient({
    personalAccessToken: token,
    spaceId: 123,
    region: 'eu',
    rateLimit: false,
  });

const BASE = 'https://mapi.storyblok.com/v1/spaces/123/experiments';

describe('experiments.list()', () => {
  it('should retrieve experiments', async () => {
    const result = await createClient().experiments.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.experiments)).toBe(true);
  });

  it('should return error on 401', async () => {
    server.use(
      http.get(BASE, () => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })),
    );

    const result = await createClient('invalid-token').experiments.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });
});

describe('experiments.get()', () => {
  it('should retrieve a single experiment by id', async () => {
    let calledPath: string | undefined;
    server.use(
      http.get(`${BASE}/:experiment_id`, ({ request }) => {
        calledPath = new URL(request.url).pathname;
        return HttpResponse.json({ experiment: { id: 55, name: 'hero_test', display_name: 'Hero Test', status: 'running', experiment_variants: [] } });
      }),
    );

    const result = await createClient().experiments.get(55);

    expect(result.error).toBeUndefined();
    expect(result.data?.experiment?.id).toBe(55);
    expect(calledPath).toBe('/v1/spaces/123/experiments/55');
  });
});

describe('experiments.create()', () => {
  it('should POST the experiment envelope and return the created experiment', async () => {
    let captured: unknown;
    server.use(
      http.post(BASE, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ experiment: { id: 55, name: 'hero_test', display_name: 'Hero Test', status: 'draft' } }, { status: 201 });
      }),
    );

    const result = await createClient().experiments.create({
      body: {
        experiment: {
          name: 'hero_test',
          display_name: 'Hero Test',
          experiment_variants_attributes: [
            { name: 'control', display_name: 'Control', is_control: true, weight: 50 },
            { name: 'variant_a', display_name: 'Variant A', weight: 50 },
          ],
        },
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.experiment?.id).toBe(55);
    expect(captured).toMatchObject({ experiment: { name: 'hero_test' } });
  });
});

describe('experiments.delete()', () => {
  it('should DELETE the experiment and resolve with no error', async () => {
    server.use(
      http.delete(`${BASE}/:experiment_id`, () => new HttpResponse(null, { status: 204 })),
    );

    const result = await createClient().experiments.delete(55);

    expect(result.error).toBeUndefined();
    expect(result.response.status).toBe(204);
  });
});

describe('experiments lifecycle', () => {
  it('activate() should PUT to /activate', async () => {
    let calledPath: string | undefined;
    server.use(
      http.put(`${BASE}/:experiment_id/activate`, ({ request }) => {
        calledPath = new URL(request.url).pathname;
        return HttpResponse.json({ experiment: { id: 55, status: 'running' } });
      }),
    );

    const result = await createClient().experiments.activate(55);

    expect(result.error).toBeUndefined();
    expect(result.data?.experiment?.status).toBe('running');
    expect(calledPath).toBe('/v1/spaces/123/experiments/55/activate');
  });

  it('completeWithWinner() should PATCH with the variant_id query param', async () => {
    let variantIdParam: string | null = null;
    server.use(
      http.patch(`${BASE}/:experiment_id/complete_with_winner`, ({ request }) => {
        variantIdParam = new URL(request.url).searchParams.get('variant_id');
        return HttpResponse.json({ experiment: { id: 55, status: 'completed', winning_variant_id: 77 } });
      }),
    );

    const result = await createClient().experiments.completeWithWinner(55, 77);

    expect(result.error).toBeUndefined();
    expect(result.data?.experiment?.winning_variant_id).toBe(77);
    expect(variantIdParam).toBe('77');
  });
});

describe('experiments.stories', () => {
  it('create() should POST the experiment_story envelope', async () => {
    let captured: unknown;
    server.use(
      http.post(`${BASE}/:experiment_id/stories`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ experiment: { id: 55, story_ids: [999] } }, { status: 201 });
      }),
    );

    const result = await createClient().experiments.stories.create(55, {
      body: { experiment_story: { story_id: 999 } },
    });

    expect(result.error).toBeUndefined();
    expect(captured).toMatchObject({ experiment_story: { story_id: 999 } });
  });

  it('delete() should DELETE the experiment story path', async () => {
    let calledPath: string | undefined;
    server.use(
      http.delete(`${BASE}/:experiment_id/stories/:story_id`, ({ request }) => {
        calledPath = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const result = await createClient().experiments.stories.delete(55, 999);

    expect(result.error).toBeUndefined();
    expect(result.response.status).toBe(204);
    expect(calledPath).toBe('/v1/spaces/123/experiments/55/stories/999');
  });
});

describe('experiments.storyMappings', () => {
  it('create() should POST to the nested variants path with the mapping envelope', async () => {
    let calledPath: string | undefined;
    let captured: unknown;
    server.use(
      http.post(`${BASE}/:experiment_id/variants/:variant_id/story_mappings`, async ({ request }) => {
        calledPath = new URL(request.url).pathname;
        captured = await request.json();
        return HttpResponse.json({ story_mapping: { original_story_id: 999, variant_story_id: 1001 } }, { status: 201 });
      }),
    );

    const result = await createClient().experiments.storyMappings.create(55, 77, {
      body: { story_mapping: { original_story_id: 999 } },
    });

    expect(result.error).toBeUndefined();
    expect(calledPath).toBe('/v1/spaces/123/experiments/55/variants/77/story_mappings');
    expect(captured).toMatchObject({ story_mapping: { original_story_id: 999 } });
    expect(result.data?.story_mapping?.variant_story_id).toBe(1001);
  });

  it('delete() should DELETE the deeply nested mapping path', async () => {
    let calledPath: string | undefined;
    server.use(
      http.delete(`${BASE}/:experiment_id/variants/:variant_id/story_mappings/:original_story_id`, ({ request }) => {
        calledPath = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const result = await createClient().experiments.storyMappings.delete(55, 77, 999);

    expect(result.error).toBeUndefined();
    expect(result.response.status).toBe(204);
    expect(calledPath).toBe('/v1/spaces/123/experiments/55/variants/77/story_mappings/999');
  });
});

describe('experiments.results', () => {
  it('push() should POST the charts payload', async () => {
    let captured: { charts?: unknown[] } | undefined;
    server.use(
      http.post(`${BASE}/:experiment_id/results`, async ({ request }) => {
        captured = (await request.json()) as { charts?: unknown[] };
        return HttpResponse.json({ experiment_result: { id: 1, experiment_id: 55, charts: captured?.charts ?? [] } });
      }),
    );

    const result = await createClient().experiments.results.push(55, {
      body: { charts: [{ kind: 'text', body: 'Variant A wins.' }] },
    });

    expect(result.error).toBeUndefined();
    expect(captured?.charts).toHaveLength(1);
    expect(result.data?.experiment_result?.experiment_id).toBe(55);
  });

  it('get() should retrieve the experiment result', async () => {
    server.use(
      http.get(`${BASE}/:experiment_id/results`, () =>
        HttpResponse.json({ experiment_result: { id: 1, experiment_id: 55, charts: [] } })),
    );

    const result = await createClient().experiments.results.get(55);

    expect(result.error).toBeUndefined();
    expect(result.data?.experiment_result?.id).toBe(1);
  });
});
