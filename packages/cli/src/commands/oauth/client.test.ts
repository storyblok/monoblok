import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { resolveOauthClient } from './client';
import { updateOauthEntry } from './store';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('resolveOauthClient', () => {
  beforeEach(() => vol.reset());
  afterEach(() => {
    delete process.env.STORYBLOK_OAUTH_CLIENT_ID;
    delete process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  });

  it('should prefer env-var client credentials over stored ones', async () => {
    await updateOauthEntry('eu', { client: { client_id: 'stored', client_secret: 'stored-secret' } });
    process.env.STORYBLOK_OAUTH_CLIENT_ID = 'env-id';
    process.env.STORYBLOK_OAUTH_CLIENT_SECRET = 'env-secret';
    const client = await resolveOauthClient('eu');
    expect(client.client_id).toBe('env-id');
  });

  it('should fall back to stored client credentials', async () => {
    await updateOauthEntry('eu', { client: { client_id: 'stored', client_secret: 'stored-secret' } });
    const client = await resolveOauthClient('eu');
    expect(client.client_id).toBe('stored');
  });

  it('should throw a helpful error when no client is configured', async () => {
    await expect(resolveOauthClient('eu')).rejects.toThrow(/oauth setup/);
  });
});
