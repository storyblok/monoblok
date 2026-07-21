// Integration coverage for the proactive OAuth-refresh path inside the shared
// preAction hook (see program.ts). This only fires end-to-end when a real
// command is run through `getProgram()`, so it is exercised here rather than
// unit-tested in isolation.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

vi.mock('node:fs');
vi.mock('node:fs/promises');
// The shared test harness (test/setup.ts) mocks session() to a static logged-in PAT
// state. This suite needs the real session/oauth-store logic to load an expiring
// OAuth session from disk, so unmock it here, matching session.oauth.test.ts.
vi.unmock('./session');
// Capture the credential the mapi client is initialized with, without hitting the
// network via the real management-api-client.
vi.mock('./api', () => ({
  getMapiClient: vi.fn(),
}));

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const seedExpiringOauthSession = () => {
  vol.fromJSON({
    [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
      oauth: {
        eu: {
          client: { client_id: 'cid', client_secret: 'secret' },
          tokens: {
            auth_type: 'oauth',
            access_token: 'sb_oat_old',
            refresh_token: 'sb_ort_old',
            // Well in the past, so isExpiringSoon() is true.
            expires_at: '2020-01-01T00:00:00.000Z',
          },
          spaces: [{ id: 5, region: 'eu' }],
        },
      },
    }),
  });
};

describe('program preAction OAuth refresh', () => {
  beforeEach(() => {
    vol.reset();
    vi.resetModules();
    // vi.resetModules() clears the dynamic-import cache, but the `./api` mock factory's
    // vi.fn() call history is tracked separately and survives it; clear it explicitly so
    // each test starts from zero calls.
    vi.clearAllMocks();
    delete process.env.STORYBLOK_LOGIN;
    delete process.env.STORYBLOK_TOKEN;
    delete process.env.STORYBLOK_REGION;
  });
  afterEach(() => vol.reset());

  it('should refresh an expiring OAuth token and initialize the mapi client with the new access token', async () => {
    seedExpiringOauthSession();
    server.use(
      http.post('https://mapi.storyblok.com/oauth/token', () =>
        HttpResponse.json({
          access_token: 'sb_oat_new',
          refresh_token: 'sb_ort_new',
          token_type: 'bearer',
          expires_in: 900,
          scope: 'stories:read offline_access',
        })),
    );

    const { getMapiClient } = await import('./api');
    const { getProgram } = await import('./program');
    const program = getProgram();
    program.command('oauth-test-refresh').action(() => {});

    await program.parseAsync(['node', 'test', 'oauth-test-refresh']);

    expect(getMapiClient).toHaveBeenCalledWith(
      expect.objectContaining({ oauthToken: 'sb_oat_new', region: 'eu' }),
    );

    // The rotated tokens are persisted before use.
    const { getOauthEntry } = await import('./commands/oauth/store');
    const entry = await getOauthEntry('eu');
    expect(entry.tokens?.access_token).toBe('sb_oat_new');
    expect(entry.tokens?.refresh_token).toBe('sb_ort_new');
  });

  it('should surface the re-login message and not throw when the refresh fails', async () => {
    seedExpiringOauthSession();
    server.use(
      http.post('https://mapi.storyblok.com/oauth/token', () =>
        HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })),
    );

    // Import the module fresh (post vi.resetModules()) so the spy targets the same
    // `konsola` instance the freshly-loaded program.ts module resolves to.
    const { konsola } = await import('./utils');
    const warnSpy = vi.spyOn(konsola, 'warn').mockImplementation(() => {});

    const { getProgram } = await import('./program');
    const program = getProgram();
    let actionRan = false;
    program.command('oauth-test-refresh-fail').action(() => {
      actionRan = true;
    });

    // The hook must not reject the command run just because the proactive refresh failed;
    // commands that don't need auth should still be able to run.
    await expect(
      program.parseAsync(['node', 'test', 'oauth-test-refresh-fail']),
    ).resolves.not.toThrow();
    expect(actionRan).toBe(true);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Please run `storyblok login` again/),
    );

    // The mapi client still gets initialized with the stale token (not a refreshed one);
    // any authed downstream call will fail on that dead token rather than silently succeed.
    const { getMapiClient } = await import('./api');
    expect(getMapiClient).toHaveBeenCalledWith(
      expect.objectContaining({ oauthToken: 'sb_oat_old' }),
    );
    expect(getMapiClient).not.toHaveBeenCalledWith(
      expect.objectContaining({ oauthToken: 'sb_oat_new' }),
    );
  });
});
