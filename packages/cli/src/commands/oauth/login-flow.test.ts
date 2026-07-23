import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { buildAuthorizeUrl, performOAuthLogin } from './login-flow';
import { getOAuthActiveRegion, getOAuthEntry } from './store';

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('../../utils/ui', () => ({ getUI: () => ({ info: vi.fn() }) }));
vi.mock('./client', () => ({
  resolveOAuthClient: vi.fn(async () => ({ client_id: 'cid', client_secret: 'sec', scopes: ['stories:read'] })),
}));
vi.mock('./pkce', () => ({
  generatePkce: () => ({ verifier: 'verifier', challenge: 'challenge' }),
  generateState: () => 'state-abc',
}));
vi.mock('./server', () => ({
  waitForCallback: vi.fn(async () => ({ code: 'auth-code', state: 'state-abc' })),
}));
vi.mock('./token-endpoint', () => ({
  exchangeToken: vi.fn(async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 900 })),
}));
vi.mock('./grant', () => ({ introspectGrant: vi.fn() }));

const { introspectGrant } = await import('./grant');

describe('buildAuthorizeUrl', () => {
  it('should build an /oauth/init URL with PKCE and space-safe params', () => {
    const url = new URL(buildAuthorizeUrl({
      region: 'eu',
      clientId: 'cid',
      scopes: ['stories:read', 'offline_access'],
      state: 'st',
      challenge: 'ch',
    }));
    expect(url.host).toBe('mapi.storyblok.com');
    expect(url.pathname).toBe('/oauth/init');
    expect(url.searchParams.get('client_id')).toBe('cid');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('stories:read offline_access');
    expect(url.searchParams.get('code_challenge')).toBe('ch');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:4900/oauth/callback');
    expect(url.searchParams.get('state')).toBe('st');
  });
});

describe('performOAuthLogin', () => {
  beforeEach(() => vol.reset());
  afterEach(() => vol.reset());

  it('should persist tokens and granted spaces after a successful introspection', async () => {
    vi.mocked(introspectGrant).mockResolvedValueOnce({ scopes: ['stories:read'], spaces: [{ id: 5, region: 'eu' }] });

    const result = await performOAuthLogin({ region: 'eu', openBrowser: async () => {} });

    expect(result.spaces).toEqual([{ id: 5, region: 'eu' }]);
    const entry = await getOAuthEntry('eu');
    expect(entry.tokens?.access_token).toBe('at');
    expect(entry.spaces).toEqual([{ id: 5, region: 'eu' }]);
  });

  it('should mark the region as active after a successful login', async () => {
    vi.mocked(introspectGrant).mockResolvedValueOnce({ scopes: ['stories:read'], spaces: [] });

    await performOAuthLogin({ region: 'us', openBrowser: async () => {} });

    expect(await getOAuthActiveRegion()).toBe('us');
  });

  it('should not persist tokens when introspection fails', async () => {
    vi.mocked(introspectGrant).mockRejectedValueOnce(new Error('introspection failed'));

    await expect(performOAuthLogin({ region: 'eu', openBrowser: async () => {} })).rejects.toThrow('introspection failed');

    expect(await getOAuthEntry('eu')).toEqual({});
    expect(await getOAuthActiveRegion()).toBeUndefined();
  });
});
