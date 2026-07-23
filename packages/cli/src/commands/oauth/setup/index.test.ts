import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { oauthCommand } from '../index';
import { getOAuthEntry } from '../store';
import { getUI } from '../../../utils/ui';

vi.mock('node:fs');
vi.mock('node:fs/promises');

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('oauth setup command', () => {
  beforeEach(() => vol.reset());

  it('should store manually provided client credentials', async () => {
    await oauthCommand.parseAsync(['node', 'test', 'setup', '--client-id', 'manual-id', '--client-secret', 'manual-secret', '--region', 'eu']);
    const entry = await getOAuthEntry('eu');
    expect(entry.client).toEqual({ client_id: 'manual-id', client_secret: 'manual-secret' });
  });

  it('should provision the client via a PAT and store it', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/oauth_clients', () => HttpResponse.json({ oauth_clients: [] })),
      http.get('https://mapi.storyblok.com/v1/oauth_clients/metadata', () =>
        HttpResponse.json({ available_scopes: [{ resource: 'stories', actions: ['read'] }], additional_scopes: ['offline_access'] })),
      http.post('https://mapi.storyblok.com/v1/oauth_clients', () =>
        HttpResponse.json({ oauth_client: { id: 1, name: 'Storyblok CLI', oauth_identifier: 'pat-cid', oauth_secret: 'pat-secret' } })),
    );

    await oauthCommand.parseAsync(['node', 'test', 'setup', '--token', 'pat', '--region', 'eu']);
    const entry = await getOAuthEntry('eu');
    expect(entry.client?.client_id).toBe('pat-cid');
    expect(entry.client?.scopes).toContain('stories:read');
  });

  it('should stop the spinner when provisioning fails', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/oauth_clients', () => new HttpResponse(null, { status: 403 })),
    );
    const spinner = { succeed: vi.fn(), failed: vi.fn() };
    const spy = vi.spyOn(getUI(), 'createSpinner').mockReturnValue(spinner as unknown as ReturnType<ReturnType<typeof getUI>['createSpinner']>);

    await oauthCommand.parseAsync(['node', 'test', 'setup', '--token', 'pat', '--region', 'eu']);

    expect(spinner.failed).toHaveBeenCalledTimes(1);
    expect(spinner.succeed).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
