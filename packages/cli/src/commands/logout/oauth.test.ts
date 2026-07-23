import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import '../../index';
import { logoutCommand } from './index';
import { getOAuthEntry } from '../oauth/store';

vi.mock('node:fs');
vi.mock('node:fs/promises');
// The shared test setup mocks `session()` (defaulting to a logged-in PAT session). Logout
// needs the real session logic here so `authType` becomes 'oauth' and `clearOAuthSession`
// genuinely clears the store, matching the technique used in `src/session.oauth.test.ts`.
vi.unmock('../../session');

const revokeRequests: string[] = [];
const server = setupServer(
  // RFC 7009 revoke: always 200 with an empty body (storyrails `head :ok`).
  http.post('https://mapi.storyblok.com/oauth/revoke', async ({ request }) => {
    revokeRequests.push(await request.text());
    return new HttpResponse(null, { status: 200 });
  }),
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('logout with an oauth session', () => {
  beforeEach(() => {
    vol.reset();
    vi.resetModules();
    server.resetHandlers();
    revokeRequests.length = 0;
    delete process.env.STORYBLOK_LOGIN;
    delete process.env.STORYBLOK_TOKEN;
    delete process.env.STORYBLOK_REGION;
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        oauth: { eu: { tokens: { auth_type: 'oauth', access_token: 'sb_oat_x', refresh_token: 'sb_ort_x', expires_at: '2026-07-20T12:00:00.000Z' }, spaces: [{ id: 5, region: 'eu' }] } },
      }),
    });
  });
  afterEach(() => vol.reset());

  it('should clear the stored oauth section', async () => {
    await logoutCommand.parseAsync(['node', 'test']);
    expect(await getOAuthEntry('eu')).toEqual({});
  });

  it('should preserve provisioned client credentials on logout', async () => {
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        oauth: { eu: { client: { client_id: 'id', client_secret: 'secret' }, tokens: { auth_type: 'oauth', access_token: 'sb_oat_x', refresh_token: 'sb_ort_x', expires_at: '2026-07-20T12:00:00.000Z' }, spaces: [{ id: 5, region: 'eu' }] } },
      }),
    });

    await logoutCommand.parseAsync(['node', 'test']);

    const entry = await getOAuthEntry('eu');
    expect(entry.client).toEqual({ client_id: 'id', client_secret: 'secret' });
    expect(entry.tokens).toBeUndefined();
    expect(entry.spaces).toBeUndefined();
  });

  it('should revoke the refresh token server-side before clearing the session', async () => {
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        oauth: { eu: { client: { client_id: 'id', client_secret: 'secret' }, tokens: { auth_type: 'oauth', access_token: 'sb_oat_x', refresh_token: 'sb_ort_x', expires_at: '2026-07-20T12:00:00.000Z' }, spaces: [{ id: 5, region: 'eu' }] } },
      }),
    });

    await logoutCommand.parseAsync(['node', 'test']);

    expect(revokeRequests).toHaveLength(1);
    const body = new URLSearchParams(revokeRequests[0]);
    expect(body.get('token')).toBe('sb_ort_x');
    expect(body.get('client_id')).toBe('id');
    expect(body.get('client_secret')).toBe('secret');
    expect(await getOAuthEntry('eu')).toEqual({ client: { client_id: 'id', client_secret: 'secret' } });
  });

  it('should still clear the local session when revocation fails', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/oauth/revoke', () => new HttpResponse(null, { status: 500 })),
    );
    vol.fromJSON({
      [`${process.env.HOME}/.storyblok/credentials.json`]: JSON.stringify({
        oauth: { eu: { client: { client_id: 'id', client_secret: 'secret' }, tokens: { auth_type: 'oauth', access_token: 'sb_oat_x', refresh_token: 'sb_ort_x', expires_at: '2026-07-20T12:00:00.000Z' }, spaces: [{ id: 5, region: 'eu' }] } },
      }),
    });

    await logoutCommand.parseAsync(['node', 'test']);

    const entry = await getOAuthEntry('eu');
    expect(entry.tokens).toBeUndefined();
    expect(entry.client).toEqual({ client_id: 'id', client_secret: 'secret' });
  });
});
