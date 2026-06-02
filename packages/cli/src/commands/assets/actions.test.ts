import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { getMapiClient } from '../../api';
import { transferAsset } from './actions';
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

    await expect(transferAsset('123', 42, 7)).rejects.toMatchObject({
      message: expect.stringContaining('write access'),
    });
    await expect(transferAsset('123', 42, 7)).rejects.toBeInstanceOf(APIError);
    const error = await transferAsset('123', 42, 7).catch(e => e);
    expect(error.code).toBe(403);
  });
});
