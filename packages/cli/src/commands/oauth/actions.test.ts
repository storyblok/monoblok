import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { findOrCreateCliClient } from './actions';

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const metadata = {
  available_scopes: [{ resource: 'stories', actions: ['read', 'write'] }],
  additional_scopes: ['offline_access'],
};

describe('findOrCreateCliClient', () => {
  it('should reuse an existing "Storyblok CLI" app and read its secret', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/oauth_clients', () =>
        HttpResponse.json({ oauth_clients: [{ id: 7, name: 'Storyblok CLI' }] })),
      http.get('https://mapi.storyblok.com/v1/oauth_clients/metadata', () => HttpResponse.json(metadata)),
      http.get('https://mapi.storyblok.com/v1/oauth_clients/7', () =>
        HttpResponse.json({ oauth_client: { id: 7, name: 'Storyblok CLI', oauth_identifier: 'cid', oauth_secret: 'secret' } })),
    );

    const client = await findOrCreateCliClient('pat', 'eu');
    expect(client).toEqual({ client_id: 'cid', client_secret: 'secret', scopes: ['stories:read', 'stories:write', 'offline_access'] });
  });

  it('should create the app when none exists', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/oauth_clients', () => HttpResponse.json({ oauth_clients: [] })),
      http.get('https://mapi.storyblok.com/v1/oauth_clients/metadata', () => HttpResponse.json(metadata)),
      http.post('https://mapi.storyblok.com/v1/oauth_clients', () =>
        HttpResponse.json({ oauth_client: { id: 8, name: 'Storyblok CLI', oauth_identifier: 'new-cid', oauth_secret: 'new-secret' } })),
    );

    const client = await findOrCreateCliClient('pat', 'eu');
    expect(client.client_id).toBe('new-cid');
  });

  it('should give manual-path guidance on a 403', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/oauth_clients', () =>
        HttpResponse.json({ error: 'You can not access this endpoint with your role on Organization' }, { status: 403 })),
    );
    await expect(findOrCreateCliClient('pat', 'eu')).rejects.toThrow(/--client-id/);
  });
});
