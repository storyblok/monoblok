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
vi.spyOn(actions, 'transferAsset');

const server = setupServer();

const preconditions = {
  canTransferAssets(orgId = '99', { space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId/convert`, ({ params }) => {
        const asset = makeMockAsset({
          id: Number(params.assetId),
          filename: `https://a.storyblok.com/g/${orgId}/500x500/asset-${params.assetId}.png`,
        });
        return HttpResponse.json({ ...asset, space_id: null });
      }),
    );
  },
  failsToTransferWithPlanError({ space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId/convert`, () =>
        HttpResponse.json({ error: 'Forbidden' }, { status: 403 })),
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

  it('should transfer a local asset to the global library', async () => {
    preconditions.canTransferAssets('99');

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAsset).toHaveBeenCalledWith(DEFAULT_SPACE, 42, 7);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('/g/99/'));
    expect(process.exitCode).toBe(0);
  });

  it('should transfer multiple asset IDs and report one row per ID', async () => {
    preconditions.canTransferAssets('99');

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '43', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(actions.transferAsset).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('42'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('43'));
    expect(process.exitCode).toBe(0);
  });

  it('should fail with a clear error when --folder-id is omitted', async () => {
    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE]);

    expect(actions.transferAsset).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('--folder-id'), '');
    expect(process.exitCode).toBe(2);
  });

  it('should print the plan and make no API calls in dry-run mode', async () => {
    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE, '--folder-id', '7', '--dry-run']);

    expect(actions.transferAsset).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE ENABLED'));
    expect(process.exitCode).toBe(0);
  });

  it('should surface a friendly message and exit 1 on a plan-gated 403', async () => {
    preconditions.failsToTransferWithPlanError();

    await assetsCommand.parseAsync(['node', 'test', 'transfer', '42', '--space', DEFAULT_SPACE, '--folder-id', '7']);

    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('not available on your current plan'));
    expect(process.exitCode).toBe(1);
  });
});
