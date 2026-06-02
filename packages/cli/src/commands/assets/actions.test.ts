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
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:spaceId/assets/:assetId/convert', () =>
        HttpResponse.json({ id: 42, filename: 'https://a.storyblok.com/g/99/500x500/shared.png' })),
    );

    const asset = await transferAsset('123', 42, 7);

    expect(asset.filename).toContain('/g/99/');
  });

  it('should surface a friendly plan-gated message on 403', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/:spaceId/assets/:assetId/convert', () =>
        HttpResponse.json({ error: 'Forbidden' }, { status: 403 })),
    );

    await expect(transferAsset('123', 42, 7)).rejects.toMatchObject({
      message: expect.stringContaining('not available on your current plan'),
    });
    await expect(transferAsset('123', 42, 7)).rejects.toBeInstanceOf(APIError);
  });
});
