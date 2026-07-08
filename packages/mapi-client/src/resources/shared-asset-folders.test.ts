import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createManagementApiClient } from '../index';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = createManagementApiClient({ personalAccessToken: 'test-token', spaceId: 12345, region: 'eu', rateLimit: false });

describe('sharedAssetFolders resource', () => {
  it('lists shared asset folders for the active space with access levels', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders', () =>
        HttpResponse.json({
          shared_asset_folders: [
            { id: 1, name: 'Brand', parent_id: null, uuid: 'u1', regions: ['eu'], asset_folder_access: [{ space_id: 12345, access_level: 'write' }] },
          ],
        })),
    );

    const { data } = await client.sharedAssetFolders.list();

    expect(data?.shared_asset_folders?.[0]?.asset_folder_access?.[0]?.access_level).toBe('write');
  });

  it('creates a shared asset folder', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders', async ({ request }) => {
        const body = await request.json() as { shared_asset_folder: { name: string } };
        return HttpResponse.json({ shared_asset_folder: { id: 9, name: body.shared_asset_folder.name, parent_id: null, uuid: 'u9' } }, { status: 201 });
      }),
    );

    const { data } = await client.sharedAssetFolders.create({ body: { shared_asset_folder: { name: 'New' } } });

    expect(data?.shared_asset_folder?.id).toBe(9);
  });
});
