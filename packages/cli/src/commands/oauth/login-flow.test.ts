import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl } from './login-flow';

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
