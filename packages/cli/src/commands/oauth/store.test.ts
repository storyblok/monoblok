import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { clearOauthTokens, getOauthClientFromEnv, getOauthEntry, updateOauthEntry } from './store';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('oauth store', () => {
  beforeEach(() => vol.reset());
  afterEach(() => {
    delete process.env.STORYBLOK_OAUTH_CLIENT_ID;
    delete process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  });

  it('should round-trip an oauth entry per region', async () => {
    await updateOauthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', refresh_token: 'r', expires_at: '2026-07-20T00:00:00.000Z' } });
    const entry = await getOauthEntry('eu');
    expect(entry.tokens?.access_token).toBe('a');
    expect(await getOauthEntry('us')).toEqual({});
  });

  it('should merge patches without dropping sibling keys', async () => {
    await updateOauthEntry('eu', { client: { client_id: 'id', client_secret: 'secret' } });
    await updateOauthEntry('eu', { spaces: [{ id: 1, region: 'eu' }] });
    const entry = await getOauthEntry('eu');
    expect(entry.client?.client_id).toBe('id');
    expect(entry.spaces).toEqual([{ id: 1, region: 'eu' }]);
  });

  it('should clear tokens only for the requested region', async () => {
    await updateOauthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' } });
    await updateOauthEntry('us', { tokens: { auth_type: 'oauth', access_token: 'b', expires_at: 'y' } });
    await clearOauthTokens('eu');
    expect(await getOauthEntry('eu')).toEqual({});
    expect((await getOauthEntry('us')).tokens?.access_token).toBe('b');
  });

  it('should preserve provisioned client credentials when clearing tokens', async () => {
    await updateOauthEntry('eu', {
      client: { client_id: 'id', client_secret: 'secret' },
      tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' },
      spaces: [{ id: 1, region: 'eu' }],
    });
    await clearOauthTokens('eu');
    const entry = await getOauthEntry('eu');
    expect(entry.client).toEqual({ client_id: 'id', client_secret: 'secret' });
    expect(entry.tokens).toBeUndefined();
    expect(entry.spaces).toBeUndefined();
  });

  it('should read client credentials from env vars when present', () => {
    process.env.STORYBLOK_OAUTH_CLIENT_ID = 'env-id';
    process.env.STORYBLOK_OAUTH_CLIENT_SECRET = 'env-secret';
    expect(getOauthClientFromEnv()).toEqual({ client_id: 'env-id', client_secret: 'env-secret' });
  });
});
