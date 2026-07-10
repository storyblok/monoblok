import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
import '../index';
import { assetsCommand } from '../command';
import { resetReporter } from '../../../lib/reporter/reporter';
import { getProgram } from '../../../program';
import * as actions from '../actions';
import { DEFAULT_SPACE } from '../../__tests__/helpers';
import { makeMockAsset } from '../__tests__/helpers';

vi.spyOn(console, 'log');
vi.spyOn(console, 'error');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');
vi.spyOn(actions, 'transferAssets');

const server = setupServer();

const preconditions = {
  canTransferAssets({ space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId/convert`, ({ params }) => {
        // The backend convert flips ownership only: space_id becomes null and
        // the original `/f/{space_id}/` filename is kept (no `/g/{org_id}/`
        // rewrite). space_id: null is the reliable shared marker.
        const asset = makeMockAsset({
          id: Number(params.assetId),
          filename: `https://a.storyblok.com/f/${space}/500x500/asset-${params.assetId}.png`,
        });
        return HttpResponse.json({ ...asset, space_id: null });
      }),
    );
  },
  failsToTransferWithAuthError({ space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId/convert`, () =>
        HttpResponse.json({ error: 'Forbidden' }, { status: 403 })),
    );
  },
  canListAssets(assets: Array<{ id: number }>, { space = DEFAULT_SPACE, onRequest }: { space?: string; onRequest?: (url: URL) => void } = {}) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/assets`, ({ request }) => {
        const url = new URL(request.url);
        onRequest?.(url);
        const page = Number(url.searchParams.get('page') ?? 1);
        return HttpResponse.json(
          { assets: page === 1 ? assets : [] },
          { headers: { 'Total': String(assets.length), 'Per-Page': '100' } },
        );
      }),
    );
  },
  failsToListAssets({ space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/assets`, () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 })),
    );
  },
};

describe('assets transfer command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    resetReporter();
    getProgram().setOptionValueWithSource('path', undefined, 'default');
    process.exitCode = undefined;
  });
  afterAll(() => server.close());

  it('should transfer a local asset to the shared library', async () => {
    preconditions.canTransferAssets();

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAssets).toHaveBeenCalledWith(DEFAULT_SPACE, [42], 7, expect.anything());
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('transferred'));
    expect(process.exitCode).toBe(0);
  });

  it('should transfer multiple asset IDs and report one row per ID', async () => {
    preconditions.canTransferAssets();

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '43', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAssets).toHaveBeenCalledWith(DEFAULT_SPACE, [42, 43], 7, expect.anything());
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('42'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('43'));
    expect(process.exitCode).toBe(0);
  });

  it('should fail with a clear error when --folder-id is omitted', async () => {
    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE]);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--folder-id'), '');
    expect(process.exitCode).toBe(2);
  });

  it('should reject --folder-id 0 as invalid', async () => {
    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE, '--folder-id', '0']);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--folder-id'), '');
    expect(process.exitCode).toBe(2);
  });

  it('should print the plan and make no API calls in dry-run mode', async () => {
    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE, '--folder-id', '7', '--dry-run']);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE ENABLED'));
    expect(process.exitCode).toBe(0);
  });

  it('should surface a friendly message and exit 1 on a 403', async () => {
    preconditions.failsToTransferWithAuthError();

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('write access'));
    expect(process.exitCode).toBe(1);
  });

  it('should transfer every space asset when --all is set', async () => {
    preconditions.canListAssets([{ id: 42 }, { id: 43 }]);
    preconditions.canTransferAssets();

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '--all', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAssets).toHaveBeenCalledWith(DEFAULT_SPACE, [42, 43], 7, expect.anything());
    expect(process.exitCode).toBe(0);
  });

  it('should reject --all combined with explicit asset IDs', async () => {
    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--all', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--all'), '');
    expect(process.exitCode).toBe(2);
  });

  it('should fail when neither --all nor asset IDs are provided', async () => {
    await assetsCommand.parseAsync(['node', 'test', 'transfer', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it('should exit 0 without transferring when --all finds no assets', async () => {
    preconditions.canListAssets([]);

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '--all', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    // `ui.info` calls `console.info` directly (see UI#info in utils/ui.ts).
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('No assets found'));
    expect(process.exitCode).toBe(0);
  });

  it('should surface a friendly error and exit 2 when enumeration fails for --all', async () => {
    preconditions.failsToListAssets();

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '--all', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(2);
  });

  it('should enumerate but not transfer in --all --dry-run mode', async () => {
    preconditions.canListAssets([{ id: 42 }, { id: 43 }]);

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '--all', '--space', DEFAULT_SPACE, '--folder-id', '7', '--dry-run']);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE ENABLED'));
    expect(process.exitCode).toBe(0);
  });

  it('should forward --query filters to the asset list request when --all is set', async () => {
    let seen: URL | undefined;
    preconditions.canListAssets([{ id: 42 }], { onRequest: (url) => { seen = url; } });
    preconditions.canTransferAssets();

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '--all', '--query', 'search=logo&with_tags=hero', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(seen?.searchParams.get('search')).toBe('logo');
    expect(seen?.searchParams.get('with_tags')).toBe('hero');
    expect(actions.transferAssets).toHaveBeenCalledWith(DEFAULT_SPACE, [42], 7, expect.anything());
    expect(process.exitCode).toBe(0);
  });

  it('should transfer the filtered set when --query is used without --all', async () => {
    let seen: URL | undefined;
    preconditions.canListAssets([{ id: 42 }], { onRequest: (url) => { seen = url; } });
    preconditions.canTransferAssets();

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '--query', 'search=logo', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(seen?.searchParams.get('search')).toBe('logo');
    expect(actions.transferAssets).toHaveBeenCalledWith(DEFAULT_SPACE, [42], 7, expect.anything());
    expect(process.exitCode).toBe(0);
  });

  it('should reject --query combined with explicit asset IDs', async () => {
    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--query', 'search=logo', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAssets).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--query'), '');
    expect(process.exitCode).toBe(2);
  });
});
