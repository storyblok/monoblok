import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createManagementApiClient } from '../index';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = createManagementApiClient({ personalAccessToken: 'test-token', spaceId: 12345, region: 'eu', rateLimit: false });

describe('sharedInternalTags resource', () => {
  it('lists tags scoped to a library via asset_folder_id', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_internal_tags', ({ request }) => {
        expect(new URL(request.url).searchParams.get('asset_folder_id')).toBe('7');
        return HttpResponse.json({ internal_tags: [{ id: 3, name: 'hero', object_type: 'asset' }] });
      }),
    );

    const { data } = await client.sharedInternalTags.list({ query: { asset_folder_id: 7 } });

    expect(data?.internal_tags?.[0]?.name).toBe('hero');
  });

  it('creates a tag with asset_folder_id in the body', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/v1/spaces/12345/shared_internal_tags', async ({ request }) => {
        const body = await request.json() as { shared_internal_tag: { asset_folder_id: number } };
        expect(body.shared_internal_tag.asset_folder_id).toBe(7);
        return HttpResponse.json({ internal_tag: { id: 4, name: 'new', object_type: 'asset' } });
      }),
    );

    const { data } = await client.sharedInternalTags.create({ body: { shared_internal_tag: { name: 'new', object_type: 'asset', asset_folder_id: 7 } } });

    expect(data?.internal_tag?.id).toBe(4);
  });
});
