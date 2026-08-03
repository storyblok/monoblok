import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createManagementApiClient } from '../index';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = createManagementApiClient({ personalAccessToken: 'test-token', spaceId: 12345, region: 'eu', rateLimit: false });

describe('sharedAssets resource', () => {
  it('lists shared assets for a library', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_assets', ({ request }) => {
        expect(new URL(request.url).searchParams.get('in_folder')).toBe('7');
        return HttpResponse.json({ assets: [{ id: 1, filename: 'https://a.storyblok.com/f/12345/x.png', asset_folder_id: 7 }] }, { headers: { 'Total': '1', 'Per-Page': '100' } });
      }),
    );

    const { data } = await client.sharedAssets.list({ query: { in_folder: 7 } });

    expect(data?.assets?.[0]?.id).toBe(1);
  });

  it('creates a shared asset via sign -> S3 -> finish flow', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/12345/shared_assets', () =>
        HttpResponse.json({ id: 55, post_url: 'https://s3.test/upload', fields: { 'key': 'g/1/x.png', 'Content-Type': 'image/png' } })),
      http.post('https://s3.test/upload', () => new HttpResponse(null, { status: 204 })),
      http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_assets/55/finish_upload', () =>
        HttpResponse.json({ id: 55, filename: 'https://a.storyblok.com/g/1/x.png' })),
      http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_assets/55', () =>
        HttpResponse.json({ id: 55, filename: 'https://a.storyblok.com/g/1/x.png', asset_folder_id: 7 })),
    );

    const asset = await client.sharedAssets.create({ body: { short_filename: 'x.png', asset_folder_id: 7 }, file: new ArrayBuffer(4) });

    expect(asset.id).toBe(55);
  });

  // Regression guard: replacing a shared asset's file re-signs the *existing*
  // asset by passing an undocumented `id` query param (and no
  // `asset_folder_id`). Neither is in the OpenAPI spec, so the generated types
  // cannot enforce it — dropping `id` would silently create a duplicate asset
  // instead of replacing the file.
  it('re-signs an existing shared asset when replacing its file', async () => {
    const signRequests: URL[] = [];
    const updatedIds: string[] = [];
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/12345/shared_assets', ({ request }) => {
        signRequests.push(new URL(request.url));
        return HttpResponse.json({ id: 77, post_url: 'https://s3.test/upload', fields: { 'key': 'g/1/y.png', 'Content-Type': 'image/png' } });
      }),
      http.post('https://s3.test/upload', () => new HttpResponse(null, { status: 204 })),
      http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_assets/77/finish_upload', () =>
        HttpResponse.json({ id: 77, filename: 'https://a.storyblok.com/g/1/y.png' })),
      http.put('https://mapi.storyblok.com/v1/spaces/12345/shared_assets/:assetId', ({ params }) => {
        updatedIds.push(String(params.assetId));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await client.sharedAssets.update(77, { body: { asset: { title: 'New title' }, short_filename: 'y.png' }, file: new ArrayBuffer(4) });

    expect(signRequests).toHaveLength(1);
    expect(signRequests[0]?.searchParams.get('id')).toBe('77');
    expect(signRequests[0]?.searchParams.get('filename')).toBe('y.png');
    expect(signRequests[0]?.searchParams.has('asset_folder_id')).toBe(false);
    expect(updatedIds).toEqual(['77']);
  });
});
