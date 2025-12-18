import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Mock } from 'vitest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import '../index';
import { assetsCommand } from '../command';
import { directories } from '../../../constants';
import { resolveCommandPath } from '../../../utils/filesystem';
import { resetReporter } from '../../../lib/reporter/reporter';
import { loadManifest } from '../../assets/push/actions';
import * as actions from '../actions';

const DEFAULT_SPACE = '12345';

vi.mock('node:fs');
vi.mock('node:fs/promises');

vi.mock('../../../session', () => ({
  session: vi.fn(() => ({
    state: {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    },
    initializeSession: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.spyOn(console, 'log');
vi.spyOn(console, 'debug');
vi.spyOn(console, 'error');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');

vi.spyOn(actions, 'createAsset');
vi.spyOn(actions, 'updateAsset');
vi.spyOn(actions, 'createAssetFolder');
vi.spyOn(actions, 'updateAssetFolder');

interface MockAsset {
  id: number;
  filename: string;
  asset_folder_id?: number | null;
  meta_data?: Record<string, unknown>;
  short_filename?: string;
}

interface MockAssetFolder {
  id: number;
  uuid: string;
  name: string;
  parent_id: number | null;
  parent_uuid: string | null;
}

let id = 0;
const getID = () => {
  id += 1;
  return id;
};
const makeMockAsset = (overrides: Partial<MockAsset> = {}): MockAsset => {
  const assetId = overrides.id ?? getID();
  const name = overrides.short_filename || `asset-${assetId}.png`;
  return {
    id: assetId,
    filename: overrides.filename || `https://a.storyblok.com/f/12345/500x500/${name}`,
    asset_folder_id: null,
    ...overrides,
  };
};

const makeMockFolder = (overrides: Partial<MockAssetFolder> = {}): MockAssetFolder => {
  const folderId = overrides.id ?? getID();
  return {
    id: folderId,
    uuid: randomUUID(),
    name: overrides.name || `Folder-${folderId}`,
    parent_id: null,
    parent_uuid: null,
    ...overrides,
  };
};

const server = setupServer(
  http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/assets/:assetId', () => HttpResponse.json(
    { message: 'Not Found' },
    { status: 404 },
  )),
  http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/asset_folders/:folderId', () => HttpResponse.json(
    { message: 'Not Found' },
    { status: 404 },
  )),
);

const preconditions = {
  canLoadAssets(assets: MockAsset[], {
    space = DEFAULT_SPACE,
    basePath,
  }: { space?: string; basePath?: string } = {}) {
    const assetsDir = resolveCommandPath(directories.assets, space, basePath);
    const getFilename = (asset: MockAsset, newExt?: string) => {
      const ext = path.extname(asset.filename);
      return `${path.basename(asset.filename, ext)}_${asset.id}${newExt || ext}`;
    };
    const files = assets.map(asset => [
      path.join(assetsDir, getFilename(asset)),
      'binary-content',
    ]);
    const metadataFiles = assets.map(asset => [
      path.join(assetsDir, getFilename(asset, '.json')),
      JSON.stringify(asset),
    ]);
    vol.fromJSON(Object.fromEntries([...files, ...metadataFiles]));
  },
  canLoadAssetsManifest(manifestEntries: Record<number | string, number | string>[], {
    space = DEFAULT_SPACE,
    basePath,
  }: { space?: string; basePath?: string } = {}) {
    const manifestPath = path.join(resolveCommandPath(directories.assets, space, basePath), 'manifest.jsonl');
    vol.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const content = `${manifestEntries.map(entry => JSON.stringify(entry)).join('\n')}\n`;
    vol.fromJSON({
      [manifestPath]: content,
    });
  },
  canLoadFoldersManifest(manifestEntries: Record<number | string, number | string>[], {
    space = DEFAULT_SPACE,
    basePath,
  }: { space?: string; basePath?: string } = {}) {
    const manifestPath = path.join(resolveCommandPath(directories.assets, space, basePath), 'folders', 'manifest.jsonl');
    vol.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const content = `${manifestEntries.map(entry => JSON.stringify(entry)).join('\n')}\n`;
    vol.fromJSON({
      [manifestPath]: content,
    });
  },
  canLoadFolders(folders: MockAssetFolder[], {
    space = DEFAULT_SPACE,
    basePath,
  }: { space?: string; basePath?: string } = {}) {
    const assetsDir = resolveCommandPath(directories.assets, space, basePath);
    vol.mkdirSync(path.join(assetsDir, 'folders'), { recursive: true });
    const folderFiles = folders.map((folder) => {
      const filename = `${folder.name}_${folder.uuid}.json`;
      return [
        path.join(assetsDir, 'folders', filename),
        JSON.stringify(folder),
      ] as const;
    });
    vol.fromJSON(Object.fromEntries(folderFiles));
  },
  canCreateRemoteFolders(folders: MockAssetFolder[], {
    space = DEFAULT_SPACE,
  }: { space?: string } = {}) {
    const remoteFolders = folders.map(folder => ({
      ...folder,
      id: getID(),
      uuid: randomUUID(),
    }));
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/asset_folders`, async ({ request }) => {
        const body = await request.json();
        const match = body
          && typeof body === 'object'
          && 'asset_folder' in body
          && remoteFolders.find(f => f.name === body.asset_folder?.name);
        if (!match) {
          return HttpResponse.json({ message: 'Folder not found' }, { status: 500 });
        }
        return HttpResponse.json({ asset_folder: match });
      }),
    );
    return remoteFolders;
  },
  canFetchRemoteFolders(folders: MockAssetFolder[], { space = DEFAULT_SPACE }: { space?: string } = {}) {
    for (const folder of folders) {
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/${space}/asset_folders/${folder.id}`, () => {
          return HttpResponse.json({ asset_folder: folder });
        }),
      );
    }
  },
  canUpdateRemoteFolders(folders: MockAssetFolder[], {
    space = DEFAULT_SPACE,
  }: { space?: string } = {}) {
    const remoteFolders = folders.map(folder => ({
      ...folder,
      id: getID(),
      uuid: randomUUID(),
    }));
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${space}/asset_folders/:folderId`, async ({ params }) => {
        const match = remoteFolders.find(folder => String(folder.id) === String(params.folderId));
        if (!match) {
          return HttpResponse.json({ message: 'Folder not found' }, { status: 404 });
        }
        return HttpResponse.json({});
      }),
    );
    return remoteFolders;
  },
  canFetchRemoteAssets(assets: MockAsset[], { space = DEFAULT_SPACE }: { space?: string } = {}) {
    for (const asset of assets) {
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/${space}/assets/${asset.id}`, () => {
          return HttpResponse.json(asset);
        }),
      );
    }
  },
  canUpsertRemoteAssets(assets: MockAsset[], {
    folderMap = new Map(),
    space = DEFAULT_SPACE,
    finishUploadSpy = vi.fn(),
    updateSpy = vi.fn(),
 }: { folderMap?: Map<number, number>; space?: string; finishUploadSpy?: Mock; updateSpy?: Mock } = {}) {
    const remoteAssets = assets.map(asset => ({
      ...asset,
      id: getID(),
      filename: asset.filename.replace('/f/12345/', `/f/${space}/`),
      asset_folder_id: asset.asset_folder_id && folderMap.get(asset.asset_folder_id),
    }));
    server.use(
      // Step 1: get signed response
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/assets`, async ({ request }) => {
        const body = await request.json() as { filename?: string };
        const requestedFilename = body?.filename;

        const match = remoteAssets.find(a => path.basename(a.filename) === requestedFilename);
        if (!match) {
          return HttpResponse.json({ message: 'Error uploading asset' }, { status: 500 });
        }

        const key = `f/${space}/${match.id}/${requestedFilename}`;
        return HttpResponse.json({
          post_url: 'https://s3.amazonaws.com/a.storyblok.com',
          fields: {
            key,
          },
          id: match.id,
        });
      }),
      // Step 2: upload to S3
      http.post('https://s3.amazonaws.com/a.storyblok.com', async ({ request }) => {
        const form = await request.formData();
        const filename = (form.get('file') as { name?: string }).name;

        const match = remoteAssets.find(a => path.basename(a.filename) === filename);
        if (!match) {
          return HttpResponse.json({ message: 'Error uploading asset' }, { status: 500 });
        }

        const key = form.get('key');
        return HttpResponse.json({ key });
      }),
      // Step 3: finish upload
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId/finish_upload`, ({ params }) => {
        const match = remoteAssets.find(asset => String(asset.id) === String(params.assetId));
        if (!match) {
          return HttpResponse.json({ message: 'Error uploading asset' }, { status: 500 });
        }
        finishUploadSpy(match);
        return HttpResponse.json({ message: 'Upload finalized' });
      }),
      // Step 4: retrieve asset
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId`, ({ params }) => {
        const match = remoteAssets.find(asset => String(asset.id) === String(params.assetId));
        if (!match) {
          return HttpResponse.json({ message: 'Asset not found' }, { status: 404 });
        }
        return HttpResponse.json(match);
      }),
      // Optional: update asset metadata/folder/etc.
      http.put(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId`, async ({ params }) => {
        const match = remoteAssets.find(asset => String(asset.id) === String(params.assetId));
        if (!match) {
          return HttpResponse.json({ message: 'Asset not found' }, { status: 404 });
        }
        updateSpy(match);
        return HttpResponse.json({});
      }),
    );
    return remoteAssets;
  },
  canDownloadAssets(assets: MockAsset[], { content = 'binary-content' }: { content?: string } = {}) {
    for (const asset of assets) {
      server.use(http.get(asset.filename, () => HttpResponse.text(content)));
    }
  },
};

const parseManifest = async (space: string = DEFAULT_SPACE, basePath?: string) => {
  const manifestPath = path.join(resolveCommandPath(directories.assets, space, basePath), 'manifest.jsonl');
  return loadManifest(manifestPath);
};

const parseFoldersManifest = async (space: string = DEFAULT_SPACE, basePath?: string) => {
  const manifestPath = path.join(resolveCommandPath(directories.assets, space, basePath), 'folders', 'manifest.jsonl');
  return loadManifest(manifestPath);
};

const getReport = (space = DEFAULT_SPACE) => {
  const reportFile = Object.entries(vol.toJSON())
    .find(([filename]) => filename.includes(`reports/${space}/storyblok-assets-push-`))?.[1];

  return reportFile ? JSON.parse(reportFile) : undefined;
};

const LOG_PREFIX = 'storyblok-assets-push-';
const getLogFileContents = () => {
  return Object.entries(vol.toJSON())
    .find(([filename]) => filename.includes(LOG_PREFIX) && filename.includes('/logs/'))?.[1];
};

describe('assets push command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    resetReporter();
  });
  afterAll(() => server.close());

  it('should push assets and asset folders and map to new asset folder IDs', async () => {
    const folderMap = new Map<number, number>();
    const folder = makeMockFolder();
    const asset = makeMockAsset({ asset_folder_id: folder.id });
    preconditions.canLoadFolders([folder]);
    preconditions.canLoadAssets([asset]);
    const [remoteFolder] = preconditions.canCreateRemoteFolders([folder]);
    folderMap.set(folder.id, remoteFolder.id);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([asset], { folderMap });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    // Check if folder reference was mapped correctly before uploading the asset.
    expect(actions.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      asset_folder_id: remoteFolder.id,
    }), expect.anything(), expect.anything());
    // Manifest
    expect(await parseFoldersManifest()).toEqual([
      { old_id: folder.id, new_id: remoteFolder.id, created_at: expect.any(String) },
    ]);
    expect(await parseManifest()).toEqual([
      { old_id: asset.id, new_id: remoteAsset.id, created_at: expect.any(String) },
    ]);
    // Report
    const report = getReport();
    expect(report).toEqual({
      status: 'SUCCESS',
      meta: {
        runId: expect.any(String),
        command: 'storyblok assets push',
        cliVersion: expect.any(String),
        startedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        endedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        durationMs: expect.any(Number),
        logPath: expect.any(String),
        config: expect.any(Object),
      },
      summary: {
        folderResults: {
          total: 1,
          succeeded: 1,
          failed: 0,
        },
        assetResults: {
          total: 1,
          succeeded: 1,
          failed: 0,
        },
      },
    });
    // Logging
    const logFile = getLogFileContents();
    expect(logFile).toMatch(/Created asset folder/);
    expect(logFile).toMatch(/Uploaded asset/);
    expect(logFile).toContain('Pushing assets finished');
    expect(logFile).toContain('"folderResults":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"assetResults":{"total":1,"succeeded":1,"failed":0}');
    // UI
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 asset pushed, 0 assets failed'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Folders: 1/1 succeeded, 0 failed.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Assets: 1/1 succeeded, 0 failed.'));
  });

  it('should update asset folders that already exist instead of creating them again', async () => {
    const localFolder = makeMockFolder({ name: 'Existing Folder' });
    preconditions.canLoadFolders([localFolder]);
    const [remoteFolder] = preconditions.canUpdateRemoteFolders([localFolder]);
    preconditions.canFetchRemoteFolders([remoteFolder]);
    preconditions.canLoadFoldersManifest([{
      old_id: localFolder.id,
      new_id: remoteFolder.id,
      created_at: '2024-01-01T00:00:00.000Z',
    }]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAssetFolder).not.toHaveBeenCalled();
    expect(actions.updateAssetFolder).toHaveBeenCalledWith(expect.objectContaining({
      id: remoteFolder.id,
      name: localFolder.name,
    }), expect.anything());
    expect(await parseFoldersManifest()).toEqual([{
      old_id: localFolder.id,
      new_id: remoteFolder.id,
      created_at: '2024-01-01T00:00:00.000Z',
    }]);
  });

  it('should createa new asset with meta_data when present locally', async () => {
    const asset = makeMockAsset({
      meta_data: {
        alt: 'Alt text',
        title: 'Title',
        custom: 'Custom field',
      },
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    const updateSpy = vi.fn();
    preconditions.canUpsertRemoteAssets([asset], { updateSpy });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      meta_data: asset.meta_data,
    }));
  });

  it('should only update the asset (not the file) when updating an existing asset with a matching binary hash', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const finishUploadSpy = vi.fn();
    const updateSpy = vi.fn();
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { finishUploadSpy, updateSpy });
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canDownloadAssets([remoteAsset]);
    preconditions.canLoadAssetsManifest([{ old_id: localAsset.id, new_id: remoteAsset.id }]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(finishUploadSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalled();
  });

  it('should upload a new asset file when updating an existing asset with a different binary hash', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const finishUploadSpy = vi.fn();
    const updateSpy = vi.fn();
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { finishUploadSpy, updateSpy });
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canDownloadAssets([remoteAsset], { content: 'new-binary-content' });
    preconditions.canLoadAssetsManifest([{ old_id: localAsset.id, new_id: remoteAsset.id }]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(finishUploadSpy).toHaveBeenCalled();
  });
});
