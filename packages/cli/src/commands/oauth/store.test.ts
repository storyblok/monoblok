import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { clearOAuthTokens, getOAuthActiveRegion, getOAuthClientFromEnv, getOAuthEntry, setOAuthActiveRegion, updateOAuthEntry } from './store';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('oauth store', () => {
  beforeEach(() => vol.reset());
  afterEach(() => {
    delete process.env.STORYBLOK_OAUTH_CLIENT_ID;
    delete process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  });

  it('should round-trip an oauth entry per region', async () => {
    await updateOAuthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', refresh_token: 'r', expires_at: '2026-07-20T00:00:00.000Z' } });
    const entry = await getOAuthEntry('eu');
    expect(entry.tokens?.access_token).toBe('a');
    expect(await getOAuthEntry('us')).toEqual({});
  });

  it('should merge patches without dropping sibling keys', async () => {
    await updateOAuthEntry('eu', { client: { client_id: 'id', client_secret: 'secret' } });
    await updateOAuthEntry('eu', { spaces: [{ id: 1, region: 'eu' }] });
    const entry = await getOAuthEntry('eu');
    expect(entry.client?.client_id).toBe('id');
    expect(entry.spaces).toEqual([{ id: 1, region: 'eu' }]);
  });

  it('should clear tokens only for the requested region', async () => {
    await updateOAuthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' } });
    await updateOAuthEntry('us', { tokens: { auth_type: 'oauth', access_token: 'b', expires_at: 'y' } });
    await clearOAuthTokens('eu');
    expect(await getOAuthEntry('eu')).toEqual({});
    expect((await getOAuthEntry('us')).tokens?.access_token).toBe('b');
  });

  it('should preserve provisioned client credentials when clearing tokens', async () => {
    await updateOAuthEntry('eu', {
      client: { client_id: 'id', client_secret: 'secret' },
      tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' },
      spaces: [{ id: 1, region: 'eu' }],
    });
    await clearOAuthTokens('eu');
    const entry = await getOAuthEntry('eu');
    expect(entry.client).toEqual({ client_id: 'id', client_secret: 'secret' });
    expect(entry.tokens).toBeUndefined();
    expect(entry.spaces).toBeUndefined();
  });

  it('should read client credentials from env vars when present', () => {
    process.env.STORYBLOK_OAUTH_CLIENT_ID = 'env-id';
    process.env.STORYBLOK_OAUTH_CLIENT_SECRET = 'env-secret';
    expect(getOAuthClientFromEnv()).toEqual({ client_id: 'env-id', client_secret: 'env-secret' });
  });

  it('should round-trip the active region pointer', async () => {
    expect(await getOAuthActiveRegion()).toBeUndefined();
    await setOAuthActiveRegion('us');
    expect(await getOAuthActiveRegion()).toBe('us');
  });

  it('should ignore an active region that is not a valid region', async () => {
    await updateOAuthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' } });
    await setOAuthActiveRegion('eu');
    // Corrupt the pointer directly, bypassing the setter.
    const path = `${process.env.HOME}/.storyblok/credentials.json`;
    const stored = JSON.parse(vol.readFileSync(path, 'utf8') as string);
    stored.oauth.activeRegion = 'not-a-region';
    vol.fromJSON({ [path]: JSON.stringify(stored) });
    expect(await getOAuthActiveRegion()).toBeUndefined();
  });

  it('should not drop sibling region entries when setting the active region', async () => {
    await updateOAuthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' } });
    await setOAuthActiveRegion('eu');
    expect((await getOAuthEntry('eu')).tokens?.access_token).toBe('a');
    expect(await getOAuthActiveRegion()).toBe('eu');
  });

  it('should clear the active region pointer when its region is logged out', async () => {
    await updateOAuthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' } });
    await setOAuthActiveRegion('eu');
    await clearOAuthTokens('eu');
    expect(await getOAuthActiveRegion()).toBeUndefined();
  });

  it('should keep the active region pointer when a different region is logged out', async () => {
    await updateOAuthEntry('eu', { tokens: { auth_type: 'oauth', access_token: 'a', expires_at: 'x' } });
    await updateOAuthEntry('us', { tokens: { auth_type: 'oauth', access_token: 'b', expires_at: 'y' } });
    await setOAuthActiveRegion('us');
    await clearOAuthTokens('eu');
    expect(await getOAuthActiveRegion()).toBe('us');
  });
});
