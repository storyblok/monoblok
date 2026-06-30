import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createApiClient } from '../index';

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('experiments.list()', () => {
  it('should return experiments array', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/experiments', () => {
        return HttpResponse.json({ experiments: [], cv: 1700000000 });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.experiments.list();

    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.data?.experiments)).toBe(true);
  });

  it('should expose variants with their story mappings', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/experiments', () => {
        return HttpResponse.json({
          experiments: [
            {
              id: 1,
              name: 'homepage_hero_test',
              display_name: 'Homepage Hero Test',
              story_ids: [101],
              variants: [
                {
                  name: 'control',
                  display_name: 'Control',
                  public_id: 'var_control',
                  weight: 50,
                  is_control: true,
                  story_mappings: [
                    { original_story_id: 101, original_slug: 'home', variant_story_id: null, variant_slug: null },
                  ],
                },
                {
                  name: 'variant_a',
                  display_name: 'Variant A',
                  public_id: 'var_a',
                  weight: 50,
                  is_control: false,
                  story_mappings: [
                    { original_story_id: 101, original_slug: 'home', variant_story_id: 202, variant_slug: 'home-variant-a' },
                  ],
                },
              ],
            },
          ],
          cv: 1700000000,
        });
      }),
    );
    const client = createApiClient({
      accessToken: 'test-token',
    });

    const result = await client.experiments.list();

    expect(result.error).toBeUndefined();
    const experiment = result.data?.experiments[0];
    expect(experiment?.variants).toHaveLength(2);
    expect(experiment?.variants[1]?.story_mappings[0]?.variant_slug).toBe('home-variant-a');
  });

  it('should return error on 401', async () => {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/experiments', () => {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }),
    );
    const client = createApiClient({
      accessToken: 'invalid-token',
    });

    const result = await client.experiments.list();

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(result.response.status).toBe(401);
  });
});
