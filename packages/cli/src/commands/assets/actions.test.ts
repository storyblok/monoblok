import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { getMapiClient } from '../../api';
import { fetchAllSpaceAssetIds, transferAsset } from './actions';
import { APIError } from '../../utils/error/api-error';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  getMapiClient({ personalAccessToken: 'valid-token', region: 'eu' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('transferAsset', () => {
  it('should convert an asset and return the shared asset', async () => {
    // The backend convert flips ownership only: it sets space_id to null and
    // keeps the original `/f/{space_id}/` filename (it does not rewrite the URL
    // to a `/g/{org_id}/` prefix). space_id: null is the reliable shared marker.
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:spaceId/assets/:assetId/convert', () =>
        HttpResponse.json({ id: 42, space_id: null, filename: 'https://a.storyblok.com/f/123/500x500/shared.png' })),
    );

    const asset = await transferAsset('123', 42, 7);

    expect(asset.space_id).toBeNull();
  });

  it('should surface a friendly authorization message on 403', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:spaceId/assets/:assetId/convert', () =>
        HttpResponse.json({ error: 'Forbidden' }, { status: 403 })),
    );

    const error = await transferAsset('123', 42, 7).catch(e => e);

    expect(error).toBeInstanceOf(APIError);
    expect(error.message).toContain('write access');
    expect(error.code).toBe(403);
  });
});

describe('fetchAllSpaceAssetIds', () => {
  it('should paginate and return every numeric asset id', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/123/assets', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
        const pages: Record<number, Array<{ id: number }>> = {
          1: [{ id: 1 }, { id: 2 }],
          2: [{ id: 3 }],
        };
        return HttpResponse.json(
          { assets: pages[page] ?? [] },
          { headers: { 'Total': '3', 'Per-Page': '2' } },
        );
      }),
    );

    const ids = await fetchAllSpaceAssetIds('123');

    expect(ids).toEqual([1, 2, 3]);
  });

  it('should skip entries without a numeric id', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/123/assets', () =>
        HttpResponse.json(
          { assets: [{ id: 10 }, { id: null }, { filename: 'x.png' }] },
          { headers: { 'Total': '3', 'Per-Page': '100' } },
        )),
    );

    const ids = await fetchAllSpaceAssetIds('123');

    expect(ids).toEqual([10]);
  });

  it('should forward filter params to the asset list query', async () => {
    let seen: URL | undefined;
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/123/assets', ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json(
          { assets: [{ id: 1 }] },
          { headers: { 'Total': '1', 'Per-Page': '100' } },
        );
      }),
    );

    await fetchAllSpaceAssetIds('123', { search: 'logo' } as never);

    expect(seen?.searchParams.get('search')).toBe('logo');
  });
});
