import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
import '../index';
import { assetsCommand } from '../command';
import type { AssetsQueryParams } from '../types';
import { getLogFileContents } from '../../__tests__/helpers';
import {
  assetFileExists,
  folderFileExists,
  makeMockAsset,
  makeMockFolder,
  type MockAsset,
  type MockAssetFolder,
} from '../__tests__/helpers';

vi.spyOn(console, 'error');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');

const LOG_PREFIX = 'storyblok-assets-pull-';

const server = setupServer();
const preconditions = {
  canFetchRemoteAssetPages(assetPages: MockAsset[][], params: AssetsQueryParams = {}) {
    server.use(
      http.get(
        'https://mapi.storyblok.com/v1/spaces/12345/assets',
        ({ request }) => {
          const url = new URL(request.url);
          const matchesAllParams = Object.entries(params).every(
            ([key, value]) => url.searchParams.get(key) === String(value),
          );
          const page = Number(url.searchParams.get('page') ?? 1);
          const perPage = assetPages.length > 1 ? assetPages[0].length : 100;
          const total = assetPages.flat().length;
          const assets = matchesAllParams ? assetPages[page - 1] || [] : [];
          return HttpResponse.json(
            { assets },
            {
              headers: {
                'Total': String(total),
                'Per-Page': String(perPage),
              },
            },
          );
        },
      ),
    );
  },
  failsToFetchRemoteAssetPages() {
    server.use(http.get('https://mapi.storyblok.com/v1/spaces/12345/assets', () => HttpResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    )));
  },
  canFetchRemoteFolders(folders: MockAssetFolder[]) {
    server.use(
      http.get(
        'https://mapi.storyblok.com/v1/spaces/12345/asset_folders',
        () => HttpResponse.json(
          { asset_folders: folders },
        ),
      ),
    );
  },
  failsToFetchRemoteFolders() {
    server.use(http.get('https://mapi.storyblok.com/v1/spaces/12345/asset_folders', () => HttpResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    )));
  },
  canDownloadAssets(assets: MockAsset[]) {
    for (const asset of assets) {
      server.use(http.get(asset.filename, () => HttpResponse.text('binary-content')));
    }
  },
  failsToDownloadAsset(asset: MockAsset) {
    server.use(http.get(asset.filename, () => HttpResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    )));
  },
  canDownloadPrivateAsset(signedUrl: string, content = 'private-binary-content') {
    server.use(http.get(signedUrl, () => HttpResponse.text(content)));
  },
  failsToSaveAsset() {
    const writeError = new Error('Simulated write failure') as NodeJS.ErrnoException;
    writeError.code = 'EACCES';
    writeError.syscall = 'write';
    vi.spyOn(fs, 'writeFile').mockRejectedValue(writeError);
  },
  failsToSaveFolder() {
    const writeError = new Error('Simulated write failure') as NodeJS.ErrnoException;
    writeError.code = 'EACCES';
    writeError.syscall = 'write';
    vi.spyOn(fs, 'writeFile').mockRejectedValue(writeError);
  },
  canFetchSignedUrl(signedUrl: string) {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/assets/me', () => {
        return HttpResponse.json({ asset: { signed_url: signedUrl } });
      }),
    );
  },
  failsToFetchSignedUrl() {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/assets/me', () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
    );
  },
};

describe('assets pull command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
  });
  afterAll(() => server.close());

  it('should pull all assets', async () => {
    const assets = [makeMockAsset(), makeMockAsset(), makeMockAsset()];
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([assets]);
    preconditions.canDownloadAssets(assets);

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    expect(assets.every(assetFileExists)).toBeTruthy();
    // Report
    const reportFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('reports/12345/storyblok-assets-pull-'))?.[1];
    expect(JSON.parse(reportFile || '{}')).toEqual({
      status: 'SUCCESS',
      meta: {
        runId: expect.any(String),
        command: 'storyblok assets pull',
        cliVersion: expect.any(String),
        startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        endedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        durationMs: expect.any(Number),
        logPath: expect.any(String),
        config: expect.any(Object),
      },
      summary: {
        folderResults: {
          failed: 0,
          succeeded: 0,
          total: 0,
        },
        fetchAssetPagesResults: {
          failed: 0,
          succeeded: 1,
          total: 1,
        },
        fetchAssetsResults: {
          failed: 0,
          succeeded: 3,
          total: 3,
        },
        saveResults: {
          failed: 0,
          succeeded: 3,
          total: 3,
        },
      },
    });
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Fetched assets page 1 of 1');
    expect(logFile).toMatch(new RegExp(`Fetched asset.*?"assetId":${assets[0].id}`));
    expect(logFile).toMatch(new RegExp(`Fetched asset.*?"assetId":${assets[1].id}`));
    expect(logFile).toMatch(new RegExp(`Fetched asset.*?"assetId":${assets[2].id}`));
    expect(logFile).toMatch(new RegExp(`Saved asset.*?"assetId":${assets[0].id}`));
    expect(logFile).toMatch(new RegExp(`Saved asset.*?"assetId":${assets[1].id}`));
    expect(logFile).toMatch(new RegExp(`Saved asset.*?"assetId":${assets[2].id}`));
    expect(logFile).toContain('Pulling assets finished');
    expect(logFile).toContain('"fetchAssetPages":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"fetchAssets":{"total":3,"succeeded":3,"failed":0}');
    expect(logFile).toContain('"save":{"total":3,"succeeded":3,"failed":0}');
    // UI
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Pull results: 3 assets pulled'),
    );
  });

  it('should pull asset folders', async () => {
    const folders = [makeMockFolder(), makeMockFolder()];
    preconditions.canFetchRemoteFolders(folders);
    preconditions.canFetchRemoteAssetPages([[]]);

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    expect(folders.every(folderFileExists)).toBeTruthy();
    const reportFile = Object.entries(vol.toJSON())
      .find(([filename]) => filename.includes('reports/12345/storyblok-assets-pull-'))?.[1];
    const report = JSON.parse(reportFile || '{}');
    expect(report.summary.folderResults).toEqual({
      total: 2,
      succeeded: 2,
      failed: 0,
    });
  });

  it('should handle dry run mode correctly', async () => {
    const folders = [makeMockFolder()];
    const assets = [makeMockAsset(), makeMockAsset()];
    preconditions.canFetchRemoteFolders(folders);
    preconditions.canFetchRemoteAssetPages([assets]);
    preconditions.canDownloadAssets(assets);

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--dry-run']);

    expect(assets.every(a => assetFileExists(a) === false)).toBeTruthy();
    expect(folders.every(f => folderFileExists(f) === false)).toBeTruthy();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('DRY RUN MODE ENABLED'));
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Pull results: 2 assets pulled'),
    );
  });

  it('should only pull assets matching the given filters', async () => {
    const assets = [makeMockAsset(), makeMockAsset(), makeMockAsset()];
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([assets], {
      in_folder: '-1',
    });
    preconditions.canDownloadAssets(assets);

    await assetsCommand.parseAsync([
      'node',
      'test',
      'pull',
      '--space',
      '12345',
      '--query',
      'in_folder=-1',
    ]);

    expect(assets.every(assetFileExists)).toBeTruthy();
  });

  it('should handle file system write errors when saving an asset', async () => {
    const assets = [makeMockAsset()];
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([assets]);
    preconditions.canDownloadAssets(assets);
    preconditions.failsToSaveAsset();

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    expect(assetFileExists(assets[0])).toBeFalsy();
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Permission denied while accessing the file');
    expect(logFile).toContain('"fetchAssetPages":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"fetchAssets":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"save":{"total":1,"succeeded":0,"failed":1}');
    // UI
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Permission denied while accessing the file'),
      '',
    );
  });

  it('should handle error fetching the remote assets list', async () => {
    preconditions.failsToFetchRemoteAssetPages();
    preconditions.canFetchRemoteFolders([]);
    preconditions.canDownloadAssets([]);

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Error fetching data from the API');
    expect(logFile).toContain('"fetchAssetPages":{"total":1,"succeeded":0,"failed":1}');
    expect(logFile).toContain('"fetchAssets":{"total":0,"succeeded":0,"failed":0}');
    expect(logFile).toContain('"save":{"total":0,"succeeded":0,"failed":0}');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error fetching data from the API'),
      '',
    );
  });

  it('should handle error downloading an asset', async () => {
    const assets = [makeMockAsset(), makeMockAsset()];
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([assets]);
    preconditions.canDownloadAssets([assets[0]]);
    preconditions.failsToDownloadAsset(assets[1]);

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain(`Failed to download ${assets[1].filename}`);
    expect(logFile).toContain('"fetchAssetPages":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"fetchAssets":{"total":2,"succeeded":1,"failed":1}');
    expect(logFile).toContain('"save":{"total":1,"succeeded":1,"failed":0}');
    expect(assetFileExists(assets[0])).toBeTruthy();
    expect(assetFileExists(assets[1])).toBeFalsy();
  });

  it('should handle error fetching folders', async () => {
    preconditions.failsToFetchRemoteFolders();
    preconditions.canFetchRemoteAssetPages([[]]);
    preconditions.canDownloadAssets([]);

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Error fetching data from the API');
    expect(logFile).toContain('"folderResults":{"total":1,"succeeded":0,"failed":1}');
  });

  it('should handle error saving folders', async () => {
    const folders = [makeMockFolder()];
    preconditions.canFetchRemoteFolders(folders);
    preconditions.canFetchRemoteAssetPages([[]]);
    preconditions.canDownloadAssets([]);
    preconditions.failsToSaveFolder();

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Permission denied while accessing the file');
    expect(logFile).toContain('"folderResults":{"total":1,"succeeded":0,"failed":1}');
  });

  it('should handle pulling zero assets', async () => {
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([[]]);
    preconditions.canDownloadAssets([]);

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('"fetchAssetPages":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"fetchAssets":{"total":0,"succeeded":0,"failed":0}');
    expect(logFile).toContain('"save":{"total":0,"succeeded":0,"failed":0}');
  });

  it('should pull private assets with asset token', async () => {
    const privateAsset = makeMockAsset({ is_private: true });
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([[privateAsset]]);
    const signedUrl = 'https://signed-download-url.s3.amazonaws.com/asset.png?signature=xyz';
    preconditions.canFetchSignedUrl(signedUrl);
    preconditions.canDownloadPrivateAsset(signedUrl);

    await assetsCommand.parseAsync([
      'node',
      'test',
      'pull',
      '--space',
      '12345',
      '--asset-token',
      'test-asset-token',
    ]);

    expect(assetFileExists(privateAsset)).toBeTruthy();
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('"fetchAssets":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"save":{"total":1,"succeeded":1,"failed":0}');
  });

  it('should fail to pull private assets without asset token', async () => {
    const privateAsset = makeMockAsset({ is_private: true });
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([[privateAsset]]);

    await assetsCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);

    expect(assetFileExists(privateAsset)).toBeFalsy();
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('is private but no asset token was provided');
    expect(logFile).toContain('"fetchAssets":{"total":1,"succeeded":0,"failed":1}');
    expect(logFile).toContain('"save":{"total":0,"succeeded":0,"failed":0}');
  });

  it('should handle invalid asset token for private assets', async () => {
    const privateAsset = makeMockAsset({ is_private: true });
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([[privateAsset]]);
    preconditions.failsToFetchSignedUrl();

    await assetsCommand.parseAsync([
      'node',
      'test',
      'pull',
      '--space',
      '12345',
      '--asset-token',
      'invalid-token',
    ]);

    expect(assetFileExists(privateAsset)).toBeFalsy();
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Error fetching data from the API');
    expect(logFile).toContain('"fetchAssets":{"total":1,"succeeded":0,"failed":1}');
    expect(logFile).toContain('"save":{"total":0,"succeeded":0,"failed":0}');
  });

  it('should handle mixed private and public assets', async () => {
    const publicAsset = makeMockAsset();
    const privateAsset = makeMockAsset({ is_private: true });
    const signedUrl = 'https://signed-download-url.s3.amazonaws.com/private-asset.png?signature=xyz';
    preconditions.canFetchRemoteFolders([]);
    preconditions.canFetchRemoteAssetPages([[publicAsset, privateAsset]]);
    preconditions.canDownloadAssets([publicAsset]);
    preconditions.canFetchSignedUrl(signedUrl);
    preconditions.canDownloadPrivateAsset(signedUrl);

    await assetsCommand.parseAsync([
      'node',
      'test',
      'pull',
      '--space',
      '12345',
      '--asset-token',
      'test-asset-token',
    ]);

    expect(assetFileExists(publicAsset)).toBeTruthy();
    expect(assetFileExists(privateAsset)).toBeTruthy();
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('"fetchAssets":{"total":2,"succeeded":2,"failed":0}');
    expect(logFile).toContain('"save":{"total":2,"succeeded":2,"failed":0}');
  });
});
