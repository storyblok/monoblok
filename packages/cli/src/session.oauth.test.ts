import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';

vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.unmock('./session');

describe('session OAuth support', () => {
  beforeEach(() => {
    vol.reset();
    vi.resetModules();
    delete process.env.STORYBLOK_LOGIN;
    delete process.env.STORYBLOK_TOKEN;
    delete process.env.STORYBLOK_REGION;
  });
  afterEach(() => vol.reset());

  it('should initialize an oauth session from stored tokens when no PAT exists', async () => {
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        oauth: { eu: { tokens: { auth_type: 'oauth', access_token: 'sb_oat_x', refresh_token: 'sb_ort_x', expires_at: '2026-07-20T12:00:00.000Z' }, spaces: [{ id: 5, region: 'eu' }] } },
      }),
    });
    const { session } = await import('./session');
    const s = session();
    await s.initializeSession();
    expect(s.state.isLoggedIn).toBe(true);
    expect(s.state.authType).toBe('oauth');
    expect(s.state.oauthAccessToken).toBe('sb_oat_x');
    expect(s.state.region).toBe('eu');
  });

  it('should prefer a stored PAT over oauth tokens', async () => {
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        'api.storyblok.com': { login: 'me@example.com', password: 'pat-token', region: 'eu' },
        'oauth': { eu: { tokens: { auth_type: 'oauth', access_token: 'sb_oat_x', expires_at: 'x' } } },
      }),
    });
    const { session } = await import('./session');
    const s = session();
    await s.initializeSession();
    expect(s.state.authType).toBe('pat');
    expect(s.state.password).toBe('pat-token');
  });

  it('should not produce a broken PAT session when only an oauth section is stored', async () => {
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        oauth: { eu: { tokens: { auth_type: 'oauth', access_token: 'sb_oat_only', expires_at: 'x' } } },
      }),
    });
    const { session } = await import('./session');
    const s = session();
    await s.initializeSession();
    expect(s.state.authType).toBe('oauth');
    expect(s.state.login).toBeUndefined();
    expect(s.state.password).toBeUndefined();
    expect(s.state.oauthAccessToken).toBe('sb_oat_only');
  });

  it('should resolve the active region ahead of the fixed order when several regions are logged in', async () => {
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        oauth: {
          activeRegion: 'us',
          eu: { tokens: { auth_type: 'oauth', access_token: 'sb_oat_eu', expires_at: 'x' } },
          us: { tokens: { auth_type: 'oauth', access_token: 'sb_oat_us', expires_at: 'x' } },
        },
      }),
    });
    const { session } = await import('./session');
    const s = session();
    await s.initializeSession();
    expect(s.state.region).toBe('us');
    expect(s.state.oauthAccessToken).toBe('sb_oat_us');
  });

  it('should fall back to the fixed order when the active region has no tokens', async () => {
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        oauth: {
          activeRegion: 'us',
          eu: { tokens: { auth_type: 'oauth', access_token: 'sb_oat_eu', expires_at: 'x' } },
        },
      }),
    });
    const { session } = await import('./session');
    const s = session();
    await s.initializeSession();
    expect(s.state.region).toBe('eu');
    expect(s.state.oauthAccessToken).toBe('sb_oat_eu');
  });
});
