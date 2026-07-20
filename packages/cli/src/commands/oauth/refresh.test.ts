import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { computeExpiresAt, refreshOauthTokens } from './refresh';
import { getOauthEntry, updateOauthEntry } from './store';

vi.mock('node:fs');
vi.mock('node:fs/promises');

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('computeExpiresAt', () => {
  it('should add the lifetime in seconds to now', () => {
    expect(computeExpiresAt(900, Date.parse('2026-07-20T00:00:00.000Z'))).toBe('2026-07-20T00:15:00.000Z');
  });
});

describe('refreshOauthTokens', () => {
  beforeEach(async () => {
    vol.reset();
    await updateOauthEntry('eu', {
      client: { client_id: 'cid', client_secret: 'secret' },
      tokens: { auth_type: 'oauth', access_token: 'old-access', refresh_token: 'old-refresh', expires_at: '2026-07-20T00:00:00.000Z' },
    });
  });

  it('should key single-flight refresh by region so concurrent regions do not share a promise', async () => {
    await updateOauthEntry('us', {
      client: { client_id: 'us-cid', client_secret: 'us-secret' },
      tokens: { auth_type: 'oauth', access_token: 'us-old-access', refresh_token: 'us-old-refresh', expires_at: '2026-07-20T00:00:00.000Z' },
    });

    server.use(
      // eu and us resolve to distinct hosts (mapi.storyblok.com vs api-us.storyblok.com),
      // so each handler only ever serves its own region's refresh request.
      http.post('https://mapi.storyblok.com/oauth/token', () =>
        HttpResponse.json({ access_token: 'eu-new-access', refresh_token: 'eu-new-refresh', token_type: 'bearer', expires_in: 900, scope: 'stories:read' })),
      http.post('https://api-us.storyblok.com/oauth/token', () =>
        HttpResponse.json({ access_token: 'us-new-access', refresh_token: 'us-new-refresh', token_type: 'bearer', expires_in: 900, scope: 'stories:read' })),
    );

    const [euTokens, usTokens] = await Promise.all([
      refreshOauthTokens('eu'),
      refreshOauthTokens('us'),
    ]);

    expect(euTokens.access_token).toBe('eu-new-access');
    expect(usTokens.access_token).toBe('us-new-access');
  });

  it('should persist the rotated refresh token before returning the new access token', async () => {
    let persistedRefreshAtRequestTime: string | undefined;
    server.use(
      http.post('https://mapi.storyblok.com/oauth/token', async () => {
        persistedRefreshAtRequestTime = (await getOauthEntry('eu')).tokens?.refresh_token;
        return HttpResponse.json({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer', expires_in: 900, scope: 'stories:read' });
      }),
    );

    const tokens = await refreshOauthTokens('eu');
    expect(tokens.access_token).toBe('new-access');
    // Before the exchange resolves, the store still had the old refresh token.
    expect(persistedRefreshAtRequestTime).toBe('old-refresh');
    // After the call, the rotated refresh token is persisted.
    expect((await getOauthEntry('eu')).tokens?.refresh_token).toBe('new-refresh');
  });

  it('should throw a re-login error when the refresh grant is invalid', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/oauth/token', () =>
        HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })),
    );
    await expect(refreshOauthTokens('eu')).rejects.toThrow(/storyblok login/);
  });

  it('should throw when there is no stored refresh token', async () => {
    await updateOauthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' } });
    await expect(refreshOauthTokens('eu')).rejects.toThrow();
  });
});
