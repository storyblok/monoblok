import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { introspectGrant } from './grant';

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('introspectGrant', () => {
  // The API nests the payload under a `grant` root key
  // (storyrails oauth_controller renders `root: "grant", adapter: :json`).
  it('should unwrap the `grant` root and return scopes, expiry and granted spaces', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/oauth/grant', () =>
        HttpResponse.json({
          grant: {
            scopes: ['stories:read', 'offline_access'],
            expires_at: '2026-07-20T12:00:00.000Z',
            app: { client_id: 'cid', name: 'Storyblok CLI' },
            spaces: [{ id: 123, region: 'eu' }],
          },
        })),
    );

    const grant = await introspectGrant('eu', 'sb_oat_token');
    expect(grant.scopes).toContain('stories:read');
    expect(grant.spaces).toEqual([{ id: 123, region: 'eu' }]);
    expect(grant.app.client_id).toBe('cid');
  });

  it('should throw a CommandError on a non-2xx response', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/oauth/grant', () =>
        HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })),
    );
    await expect(introspectGrant('eu', 'bad')).rejects.toThrow();
  });
});
