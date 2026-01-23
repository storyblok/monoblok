import { randomUUID } from 'node:crypto';
import type { Buffer } from 'node:buffer';
import path from 'node:path';
import { tmpdir } from 'node:os';
import * as fsPromises from 'node:fs/promises';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { Mock } from 'vitest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { vol } from 'memfs';
import '../index';
import { assetsCommand } from '../command';
import { directories } from '../../../constants';
import { loadManifest, resolveCommandPath } from '../../../utils/filesystem';
import { resetReporter } from '../../../lib/reporter/reporter';
import { getAssetBinaryFilename, getAssetFilename, getFolderFilename } from '../utils';
import * as actions from '../actions';
import * as storyActions from '../../stories/actions';
import {
  DEFAULT_SPACE,
  getID,
  getLogFileContents,
  getReport as getReportHelper,
  makeMockComponent,
  type MockComponent,
} from '../../__tests__/helpers';
import {
  makeMockAsset,
  makeMockFolder,
  makePngBuffer,
  type MockAsset,
  type MockAssetFolder,
} from '../__tests__/helpers';
import { makeMockStory, type MockStory } from '../../stories/__tests__/helpers';

vi.spyOn(console, 'log');
vi.spyOn(console, 'error');
vi.spyOn(console, 'info');
vi.spyOn(console, 'warn');

vi.spyOn(actions, 'createAsset');
vi.spyOn(actions, 'updateAsset');
vi.spyOn(actions, 'createAssetFolder');
vi.spyOn(actions, 'updateAssetFolder');
vi.spyOn(storyActions, 'fetchStories');
vi.spyOn(storyActions, 'updateStory');

const LOG_PREFIX = 'storyblok-assets-push-';
const getReport = (space = DEFAULT_SPACE) => getReportHelper(LOG_PREFIX, space);

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
  canLoadComponents(components: MockComponent[], space = DEFAULT_SPACE, basePath?: string) {
    const componentsDir = resolveCommandPath(directories.components, space, basePath);
    vol.fromJSON(Object.fromEntries(components.map(c => [
      path.join(componentsDir, `${c.name}.json`),
      JSON.stringify(c),
    ])));
  },
  canLoadAssets(assets: MockAsset[], {
    space = DEFAULT_SPACE,
    basePath,
  }: { space?: string; basePath?: string } = {}) {
    const assetsDir = resolveCommandPath(directories.assets, space, basePath);
    const files = assets.map(asset => [
      path.join(assetsDir, getAssetBinaryFilename(asset)),
      'binary-content',
    ]);
    const metadataFiles = assets.map(asset => [
      path.join(assetsDir, getAssetFilename(asset)),
      JSON.stringify(asset),
    ]);
    vol.fromJSON(Object.fromEntries([...files, ...metadataFiles]));
  },
  failsToLoadAssets({
    space = DEFAULT_SPACE,
    basePath,
  }: { space?: string; basePath?: string } = {}) {
    const assetsDir = resolveCommandPath(directories.assets, space, basePath);
    vol.fromJSON({
      [path.join(assetsDir, 'broken.json')]: '{invalid json',
    });
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
  failsToAppendAssetsManifest() {
    const appendFileError = Object.assign(new Error('Manifest append failed'), { code: 'EACCES' });
    vi.spyOn(fsPromises, 'appendFile').mockRejectedValue(appendFileError);
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
    const folderFiles = folders.map((folder) => {
      return [
        path.join(assetsDir, 'folders', getFolderFilename(folder)),
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
  failsToCreateRemoteFolders({ space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/asset_folders`, () => HttpResponse.json(
        { message: 'Creation failed' },
        { status: 500 },
      )),
    );
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
    const remoteFolders = space === DEFAULT_SPACE
      ? folders
      : folders.map(folder => ({
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
  failsToUpdateRemoteFolders({ space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${space}/asset_folders/:folderId`, () => HttpResponse.json(
        { message: 'Update failed' },
        { status: 500 },
      )),
    );
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
    const remoteAssets = space === DEFAULT_SPACE
      ? assets
      : assets.map(asset => ({
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

        server.use(
          // Step 4: retrieve asset
          http.get(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId`, ({ params }) => {
            const match = remoteAssets.find(asset => String(asset.id) === String(params.assetId));
            if (!match) {
              return HttpResponse.json({ message: 'Asset not found' }, { status: 404 });
            }
            return HttpResponse.json(match);
          }),
        );

        return HttpResponse.json({ message: 'Upload finalized' });
      }),
      // Update asset metadata/folder/etc.
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
  failsToCreateRemoteAssets({ space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/assets`, () => HttpResponse.json(
        { message: 'Creation failed' },
        { status: 500 },
      )),
    );
  },
  failsToUpdateRemoteAssets({ space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.put(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId`, () => HttpResponse.json(
        { message: 'Update failed' },
        { status: 500 },
      )),
    );
  },
  failsToUploadAssets() {
    server.use(
      http.post('https://s3.amazonaws.com/a.storyblok.com', () => HttpResponse.json(
        { message: 'Upload failed' },
        { status: 500 },
      )),
    );
  },
  canDownloadExternalAsset(url: string) {
    server.use(http.get(url, () => {
      const content = makePngBuffer(10, 20);
      return HttpResponse.arrayBuffer(content.buffer as ArrayBuffer);
    }));
  },
  canDownloadAssets(assets: MockAsset[], { content = 'binary-content' }: { content?: string } = {}) {
    for (const asset of assets) {
      server.use(http.get(asset.filename, () => HttpResponse.text(content)));
    }
  },
  canDownloadPrivateAsset(signedUrl: string, content = 'private-binary-content') {
    server.use(http.get(signedUrl, () => HttpResponse.text(content)));
  },
  canFetchSignedUrl(signedUrl: string) {
    server.use(
      http.get('https://api.storyblok.com/v2/cdn/assets/me', () => {
        return HttpResponse.json({ asset: { signed_url: signedUrl } });
      }),
    );
  },
  canFetchRemoteStoryPages(storyPages: MockStory[][]) {
    server.use(
      http.get(
        'https://mapi.storyblok.com/v1/spaces/:spaceId/stories',
        ({ request }) => {
          const url = new URL(request.url);
          const page = Number(url.searchParams.get('page') ?? 1);
          const perPage = storyPages.length > 1 ? storyPages[0].length : 100;
          const total = storyPages.flat().length;
          const stories = storyPages[page - 1] || [];
          return HttpResponse.json(
            { stories },
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
  canFetchStories(stories: MockStory[], { space = DEFAULT_SPACE }: { space?: string } = {}) {
    for (const story of stories) {
      server.use(
        http.get(`https://mapi.storyblok.com/v1/spaces/${space}/stories/${story.id}`, () => HttpResponse.json({
          story,
        })),
      );
    }
  },
  canUpdateStories(stories: MockStory[], { space = DEFAULT_SPACE }: { space?: string } = {}) {
    for (const story of stories) {
      server.use(
        http.put(`https://mapi.storyblok.com/v1/spaces/${space}/stories/${story.id}`, () => HttpResponse.json({
          story,
        })),
      );
    }
  },
  canLoadLocalFile(filePath: string, content: Buffer | string) {
    vol.fromJSON({
      [filePath]: content,
    });
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

describe('assets push command', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    vol.reset();
    server.resetHandlers();
    resetReporter();
    process.exitCode = undefined;
  });
  afterAll(() => server.close());

  it('should push assets and asset folders and map to new asset folder IDs', async () => {
    const targetSpace = '54321';
    const folderMap = new Map<number, number>();
    const folder = makeMockFolder();
    const asset = makeMockAsset({ asset_folder_id: folder.id });
    preconditions.canLoadFolders([folder]);
    preconditions.canLoadAssets([asset]);
    const [remoteFolder] = preconditions.canCreateRemoteFolders([folder], { space: targetSpace });
    folderMap.set(folder.id, remoteFolder.id);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([asset], { folderMap, space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    // Check if folder reference was mapped correctly before uploading the asset.
    expect(actions.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      asset_folder_id: remoteFolder.id,
    }), expect.anything(), expect.anything());
    // Manifest
    expect(await parseFoldersManifest(targetSpace)).toEqual([
      { old_id: folder.id, new_id: remoteFolder.id, created_at: expect.any(String) },
    ]);
    expect(await parseManifest(targetSpace)).toEqual([
      {
        old_id: asset.id,
        old_filename: asset.filename,
        new_id: remoteAsset.id,
        new_filename: remoteAsset.filename,
        created_at: expect.any(String),
      },
    ]);
    // Report
    const report = getReport(targetSpace);
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
        assetFolderResults: {
          total: 1,
          succeeded: 1,
          failed: 0,
        },
        assetResults: {
          total: 1,
          succeeded: 1,
          skipped: 0,
          failed: 0,
        },
      },
    });
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toMatch(/Created asset folder/);
    expect(logFile).toMatch(/Uploaded asset/);
    expect(logFile).toContain('Pushing assets finished');
    expect(logFile).toContain('"assetFolderResults":{"total":1,"succeeded":1,"failed":0}');
    expect(logFile).toContain('"assetResults":{"total":1,"succeeded":1,"failed":0,"skipped":0}');
    // UI
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 processed, 0 assets failed'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Folders: 1/1 succeeded, 0 failed.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Assets: 1/1 succeeded, 0 skipped, 0 failed.'));
    expect(process.exitCode).toBe(0);
  });

  it('should correctly resolve parent IDs even when child folders precede parents', async () => {
    const targetSpace = '54321';
    const numPairs = 10;
    const folders: MockAssetFolder[] = [];
    // Generate pairs of parent-child folders
    for (let i = 0; i < numPairs; i++) {
      const parent = makeMockFolder();
      const child = makeMockFolder({ parent_id: parent.id });

      if (i % 2 === 0) {
        // Case 1: Parent before Child
        folders.push(parent, child);
      }
      else {
        // Case 2: Child before Parent
        folders.push(child, parent);
      }
    }
    preconditions.canLoadFolders(folders);
    const remoteFolders = preconditions.canCreateRemoteFolders(folders, { space: targetSpace });
    preconditions.canFetchRemoteFolders(remoteFolders, { space: targetSpace });
    // Build a map of Local ID -> Remote ID to verify expectations
    const localToRemoteId = new Map<number, number>();
    folders.forEach((local, index) => {
      localToRemoteId.set(local.id, remoteFolders[index].id);
    });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    // Verify that every child folder was created with the correct NEW remote parent_id
    for (const folder of folders) {
      const expectedRemoteParentId = folder.parent_id ? localToRemoteId.get(folder.parent_id) : undefined;
      expect(actions.createAssetFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          name: folder.name,
          parent_id: expectedRemoteParentId,
        }),
        expect.anything(),
      );
    }
  });

  it('should update stories referencing the old asset when the filename changes', async () => {
    const targetSpace = '54321';
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { space: targetSpace });
    const pageComponent = makeMockComponent({
      name: 'page',
      schema: {
        asset: {
          type: 'asset',
        },
      },
    });
    preconditions.canLoadComponents([pageComponent]);
    const story = makeMockStory({
      content: {
        _uid: randomUUID(),
        component: 'page',
        asset: {
          id: localAsset.id,
          filename: localAsset.filename,
        },
      },
    });
    preconditions.canFetchRemoteStoryPages([[story]]);
    preconditions.canFetchStories([story], { space: targetSpace });
    preconditions.canUpdateStories([story], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace, '--update-stories']);

    expect(storyActions.updateStory).toHaveBeenCalledWith(
      targetSpace,
      story.id,
      expect.objectContaining({
        story: expect.objectContaining({
          content: expect.objectContaining({
            asset: expect.objectContaining({
              id: remoteAsset.id,
              filename: remoteAsset.filename,
            }),
          }),
        }),
      }),
    );
    // Report
    const report = getReport(targetSpace);
    expect(report).toEqual({
      status: 'SUCCESS',
      meta: expect.any(Object),
      summary: {
        assetFolderResults: { total: 0, succeeded: 0, failed: 0 },
        assetResults: { total: 1, succeeded: 1, skipped: 0, failed: 0 },
        fetchStoryPages: { total: 1, succeeded: 1, failed: 0 },
        fetchStories: { total: 1, succeeded: 1, failed: 0 },
        storyProcessResults: { total: 1, succeeded: 1, failed: 0 },
        storyUpdateResults: { total: 1, succeeded: 1, failed: 0 },
      },
    });
    // UI
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 processed, 0 assets failed'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Assets: 1/1 succeeded, 0 skipped, 0 failed.'));
    expect(process.exitCode).toBe(0);
  });

  it('should update stories referencing an asset when the metadata change', async () => {
    const localAsset = makeMockAsset({
      meta_data: {
        alt: 'New alt',
        title: 'New title',
        source: 'New source',
        copyright: 'New copyright',
      },
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    preconditions.canUpsertRemoteAssets([localAsset]);
    const pageComponent = makeMockComponent({
      name: 'page',
      schema: {
        asset: {
          type: 'asset',
        },
      },
    });
    preconditions.canLoadComponents([pageComponent]);
    const story = makeMockStory({
      content: {
        _uid: randomUUID(),
        component: 'page',
        asset: {
          id: localAsset.id,
          filename: localAsset.filename,
          meta_data: {
            alt: 'Old alt',
            title: 'Old title',
            source: 'Old source',
            copyright: 'Old copyright',
          },
        },
      },
    });
    preconditions.canFetchRemoteStoryPages([[story]]);
    preconditions.canFetchStories([story]);
    preconditions.canUpdateStories([story]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', DEFAULT_SPACE, '--update-stories']);

    expect(storyActions.updateStory).toHaveBeenCalledWith(
      DEFAULT_SPACE,
      story.id,
      expect.objectContaining({
        story: expect.objectContaining({
          content: expect.objectContaining({
            asset: expect.objectContaining({
              meta_data: localAsset.meta_data,
            }),
          }),
        }),
      }),
    );
  });

  it('should publish only already published stories', async () => {
    const targetSpace = '54321';
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    preconditions.canUpsertRemoteAssets([localAsset], { space: targetSpace });
    const pageComponent = makeMockComponent({
      name: 'page',
      schema: {
        asset: {
          type: 'asset',
        },
      },
    });
    preconditions.canLoadComponents([pageComponent]);
    const storyPublished = makeMockStory({
      content: {
        _uid: randomUUID(),
        component: 'page',
        asset: {
          id: localAsset.id,
          filename: localAsset.filename,
        },
      },
      published: 1,
    });
    const storyUnpublished = makeMockStory({
      content: {
        _uid: randomUUID(),
        component: 'page',
        asset: {
          id: localAsset.id,
          filename: localAsset.filename,
        },
      },
      published: 0,
    });
    preconditions.canFetchRemoteStoryPages([[storyPublished, storyUnpublished]]);
    preconditions.canFetchStories([storyPublished, storyUnpublished], { space: targetSpace });
    preconditions.canUpdateStories([storyPublished, storyUnpublished], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace, '--update-stories']);

    expect(storyActions.updateStory).toHaveBeenCalledWith(
      targetSpace,
      storyPublished.id,
      expect.objectContaining({
        story: expect.any(Object),
        publish: 1,
      }),
    );
    expect(storyActions.updateStory).toHaveBeenCalledWith(
      targetSpace,
      storyUnpublished.id,
      expect.objectContaining({
        story: expect.any(Object),
        publish: 0,
      }),
    );
  });

  it('should not update stories if no asset references have changed', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    preconditions.canUpsertRemoteAssets([localAsset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', DEFAULT_SPACE, '--update-stories']);

    // Report
    const report = getReport();
    expect(report).toEqual({
      status: 'SUCCESS',
      meta: expect.any(Object),
      summary: {
        assetFolderResults: { total: 0, succeeded: 0, failed: 0 },
        assetResults: { total: 1, succeeded: 1, skipped: 0, failed: 0 },
      },
    });
    // UI
    expect(storyActions.updateStory).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 processed, 0 assets failed'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Assets: 1/1 succeeded, 0 skipped, 0 failed.'));
    expect(process.exitCode).toBe(0);
  });

  it('should read assets and asset folders from a custom path', async () => {
    const customPath = '.custom-storyblok';
    const folder = makeMockFolder();
    const asset = makeMockAsset({ asset_folder_id: folder.id });
    preconditions.canLoadFolders([folder], { basePath: customPath });
    preconditions.canLoadAssets([asset], { basePath: customPath });
    const [remoteFolder] = preconditions.canCreateRemoteFolders([folder]);
    const folderMap = new Map<number, number>([[folder.id, remoteFolder.id]]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([asset], { folderMap });

    await assetsCommand.parseAsync(['node', 'test', '--path', customPath, 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAssetFolder).toHaveBeenCalled();
    expect(actions.createAsset).toHaveBeenCalled();
    expect(await parseFoldersManifest(DEFAULT_SPACE, customPath)).toEqual([
      { old_id: folder.id, new_id: remoteFolder.id, created_at: expect.any(String) },
    ]);
    expect(await parseManifest(DEFAULT_SPACE, customPath)).toEqual([
      {
        old_id: asset.id,
        old_filename: asset.filename,
        new_id: remoteAsset.id,
        new_filename: remoteAsset.filename,
        created_at: expect.any(String),
      },
    ]);
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

  it('should update existing remote asset folders even when no manifest exists', async () => {
    const localFolder = makeMockFolder();
    preconditions.canLoadFolders([localFolder]);
    const [remoteFolder] = preconditions.canUpdateRemoteFolders([localFolder]);
    preconditions.canFetchRemoteFolders([remoteFolder]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAssetFolder).not.toHaveBeenCalled();
    expect(actions.updateAssetFolder).toHaveBeenCalledWith(expect.objectContaining({
      id: remoteFolder.id,
      name: remoteFolder.name,
    }), expect.anything());
    expect(await parseFoldersManifest()).toEqual([
      { old_id: localFolder.id, new_id: remoteFolder.id, created_at: expect.any(String) },
    ]);
  });

  it('should log an error and stop when manifest loading fails', async () => {
    const manifestPath = path.join(resolveCommandPath(directories.assets, DEFAULT_SPACE), 'manifest.jsonl');
    preconditions.canLoadLocalFile(manifestPath, 'not-json');

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAssetFolder).not.toHaveBeenCalled();
    expect(actions.updateAssetFolder).not.toHaveBeenCalled();
    expect(actions.createAsset).not.toHaveBeenCalled();
    expect(actions.updateAsset).not.toHaveBeenCalled();
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Unexpected token');
    expect(process.exitCode).toBe(2);
  });

  it('should handle errors when writing to the manifest fails', async () => {
    const asset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.canUpsertRemoteAssets([asset]);
    preconditions.failsToAppendAssetsManifest();

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(await parseManifest()).toEqual([]);
    // Reporting
    const report = getReport();
    expect(report?.status).toBe('FAILURE');
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('File System Error: Permission denied');
    // UI
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Push results: 1 processed, 1 assets failed'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Assets: 0/1 succeeded, 0 skipped, 1 failed.'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('should not make any updates in dry run mode', async () => {
    const asset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.canUpsertRemoteAssets([asset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--dry-run']);

    expect(actions.createAsset).not.toHaveBeenCalled();
    expect(actions.updateAsset).not.toHaveBeenCalled();
    expect(await parseManifest()).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('DRY RUN MODE ENABLED: No changes will be made.'),
    );
    expect(process.exitCode).toBe(0);
  });

  it('should handle errors when reading local assets fails', async () => {
    preconditions.canLoadFolders([]);
    preconditions.failsToLoadAssets();

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).not.toHaveBeenCalled();
    expect(actions.updateAsset).not.toHaveBeenCalled();
    // Reporting
    const report = getReport();
    expect(report?.status).toBe('FAILURE');
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Expected property name or \'}\' in JSON');
    // UI
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Push results: 1 processed, 1 assets failed'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Assets: 0/1 succeeded, 0 skipped, 1 failed.'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors when creating asset folders fails', async () => {
    const folder = makeMockFolder();
    preconditions.canLoadFolders([folder]);
    preconditions.canLoadAssetsManifest([]);
    preconditions.failsToCreateRemoteFolders();

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAssetFolder).toHaveBeenCalled();
    expect(actions.updateAssetFolder).not.toHaveBeenCalled();
    // Reporting
    const report = getReport();
    expect(report?.status).toBe('FAILURE');
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Error fetching data from the API');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/1 succeeded, 1 failed.'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors when updating asset folders fails', async () => {
    const folder = makeMockFolder({ name: 'Existing Folder' });
    preconditions.canLoadFolders([folder]);
    const [remoteFolder] = preconditions.canUpdateRemoteFolders([folder]);
    preconditions.canFetchRemoteFolders([remoteFolder]);
    preconditions.canLoadFoldersManifest([{
      old_id: folder.id,
      new_id: remoteFolder.id,
      created_at: '2024-01-01T00:00:00.000Z',
    }]);
    preconditions.canLoadAssetsManifest([]);
    preconditions.failsToUpdateRemoteFolders();

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAssetFolder).not.toHaveBeenCalled();
    expect(actions.updateAssetFolder).toHaveBeenCalled();
    // Reporting
    const report = getReport();
    expect(report?.status).toBe('FAILURE');
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('API Error: Error fetching data from the API');
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/1 succeeded, 1 failed.'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors when creating assets fails', async () => {
    const asset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.canUpsertRemoteAssets([asset]);
    preconditions.failsToCreateRemoteAssets();

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).toHaveBeenCalled();
    expect(actions.updateAsset).not.toHaveBeenCalled();
    // Reporting
    const report = getReport();
    expect(report?.status).toBe('FAILURE');
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('API Error: Error fetching data from the API');
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Push results: 1 processed, 1 assets failed'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Assets: 0/1 succeeded, 0 skipped, 1 failed.'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors when updating assets fails', async () => {
    const localAsset = makeMockAsset({
      meta_data: {
        alt: 'New alt',
        title: 'New title',
        copyright: 'New copyright',
      },
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([{
      ...localAsset,
      meta_data: {
        alt: 'Old alt',
        title: 'Old title',
        copyright: 'Old copyright',
      },
    }]);
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canDownloadAssets([remoteAsset]);
    preconditions.canLoadAssetsManifest([{ old_id: localAsset.id, new_id: remoteAsset.id }]);
    preconditions.failsToUpdateRemoteAssets();

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).not.toHaveBeenCalled();
    expect(actions.updateAsset).toHaveBeenCalled();
    // Reporting
    const report = getReport();
    expect(report?.status).toBe('FAILURE');
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Error fetching data from the API');
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Push results: 1 processed, 1 assets failed'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Assets: 0/1 succeeded, 0 skipped, 1 failed.'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors when uploading assets fails', async () => {
    const asset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.canUpsertRemoteAssets([asset]);
    preconditions.failsToUploadAssets();

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).toHaveBeenCalled();
    // Reporting
    const report = getReport();
    expect(report?.status).toBe('FAILURE');
    // Logging
    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).toContain('Error fetching data from the API');
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Push results: 1 processed, 1 assets failed'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Assets: 0/1 succeeded, 0 skipped, 1 failed.'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('should create a new asset with meta_data when present locally', async () => {
    const targetSpace = '54321';
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
    preconditions.canUpsertRemoteAssets([asset], { updateSpy, space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      meta_data: asset.meta_data,
    }));
  });

  it('should skip update when both file and metadata are unchanged', async () => {
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
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('should upload a new asset file when updating an existing asset with a different binary hash', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const finishUploadSpy = vi.fn();
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { finishUploadSpy });
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canDownloadAssets([remoteAsset], { content: 'new-binary-content' });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(finishUploadSpy).toHaveBeenCalled();
    expect(await parseManifest()).toEqual([
      {
        old_id: localAsset.id,
        old_filename: localAsset.filename,
        new_id: remoteAsset.id,
        new_filename: remoteAsset.filename,
        created_at: expect.any(String),
      },
    ]);
  });

  it('should upload a new private asset file when updating an existing asset with a different binary hash', async () => {
    const localAsset = makeMockAsset({ is_private: true });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const finishUploadSpy = vi.fn();
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { finishUploadSpy });
    preconditions.canFetchRemoteAssets([remoteAsset]);
    const signedUrl = 'https://signed-download-url.s3.amazonaws.com/asset.png?signature=xyz';
    preconditions.canFetchSignedUrl(signedUrl);
    preconditions.canDownloadPrivateAsset(signedUrl);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--asset-token', 'test-asset-token']);

    expect(finishUploadSpy).toHaveBeenCalled();
    expect(await parseManifest()).toEqual([
      {
        old_id: localAsset.id,
        old_filename: localAsset.filename,
        new_id: remoteAsset.id,
        new_filename: remoteAsset.filename,
        created_at: expect.any(String),
      },
    ]);
  });

  it('should upload a new asset file when updating an existing asset with a different binary hash when resuming from manifest', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const finishUploadSpy = vi.fn();
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { finishUploadSpy });
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canDownloadAssets([remoteAsset], { content: 'new-binary-content' });
    preconditions.canLoadAssetsManifest([{
      old_id: localAsset.id,
      old_filename: localAsset.filename,
      new_id: remoteAsset.id,
      new_filename: 'https://a.storyblok.com/f/12345/500x500/old-new-filename.png',
    }]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(finishUploadSpy).toHaveBeenCalled();
    expect((await parseManifest())[1]).toEqual({
      old_id: localAsset.id,
      old_filename: localAsset.filename,
      new_id: remoteAsset.id,
      new_filename: remoteAsset.filename,
      created_at: expect.any(String),
    });
  });

  it('should update existing remote assets even when no manifest exists', async () => {
    const localAsset = makeMockAsset({
      meta_data: {
        alt: 'New alt',
        title: 'New title',
        copyright: 'New copyright',
      },
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([{
      ...localAsset,
      meta_data: {
        alt: 'Old alt',
        title: 'Old title',
        copyright: 'Old copyright',
      },
    }]);
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canDownloadAssets([remoteAsset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).not.toHaveBeenCalled();
    expect(actions.updateAsset).toHaveBeenCalledWith(expect.objectContaining({
      id: remoteAsset.id,
    }), expect.anything(), expect.anything());
    expect(await parseManifest()).toEqual([
      {
        old_id: localAsset.id,
        new_id: remoteAsset.id,
        old_filename: localAsset.filename,
        new_filename: remoteAsset.filename,
        created_at: expect.any(String),
      },
    ]);
  });

  it('should not skip update when top-level metadata changed but meta_data object is empty', async () => {
    const localAsset = makeMockAsset({
      alt: 'New alt',
      meta_data: {},
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([{
      ...localAsset,
      alt: 'Old alt',
      meta_data: {},
    }]);
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canDownloadAssets([remoteAsset]);
    preconditions.canLoadAssetsManifest([{ old_id: localAsset.id, new_id: remoteAsset.id }]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.updateAsset).toHaveBeenCalled();
  });

  it('should use sidecar json data when pushing a single local asset without --data', async () => {
    const assetPath = '/tmp/local-asset.png';
    const assetJsonPath = '/tmp/local-asset.json';
    const pngBuffer = makePngBuffer(120, 80);
    preconditions.canLoadLocalFile(assetPath, pngBuffer);
    preconditions.canLoadLocalFile(assetJsonPath, JSON.stringify({
      meta_data: {
        alt: 'Alt text',
      },
    }));
    const asset = makeMockAsset({ short_filename: 'local-asset.png' });
    preconditions.canUpsertRemoteAssets([asset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, assetPath]);

    expect(actions.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      meta_data: {
        alt: 'Alt text',
      },
    }), expect.anything(), expect.anything());
  });

  it('should push a single local asset with inline overrides', async () => {
    const assetPath = '/tmp/local-asset.png';
    const pngBuffer = makePngBuffer(200, 300);
    preconditions.canLoadLocalFile(assetPath, pngBuffer);
    const asset = makeMockAsset({ short_filename: 'override.png' });
    preconditions.canUpsertRemoteAssets([asset]);

    await assetsCommand.parseAsync([
      'node',
      'test',
      'push',
      '--space',
      DEFAULT_SPACE,
      '--data',
      '{"meta_data":{"alt":"Alt text","alt__i18n__de":"Alt DE"}}',
      '--short-filename',
      'override.png',
      '--folder',
      '99',
      assetPath,
    ]);

    expect(actions.createAsset).toHaveBeenCalledWith(expect.objectContaining({
      short_filename: 'override.png',
      asset_folder_id: 99,
      meta_data: {
        alt: 'Alt text',
        alt__i18n__de: 'Alt DE',
      },
    }), expect.anything(), expect.anything());
  });

  it('should download an external asset and clean up the temp file after upload', async () => {
    const externalUrl = 'https://example.com/assets/external.png';
    preconditions.canDownloadExternalAsset(externalUrl);
    const asset = makeMockAsset({ short_filename: path.basename(externalUrl) });
    preconditions.canUpsertRemoteAssets([asset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup', externalUrl]);

    const tempRoot = path.join(tmpdir(), 'storyblok-assets');
    const tempFiles = Object.keys(vol.toJSON()).filter(filename => filename.startsWith(`${tempRoot}/`));
    expect(tempFiles).toEqual([]);
  });

  it('should delete local assets and asset folders when cleanup is enabled', async () => {
    const asset = makeMockAsset();
    const folder = makeMockFolder();
    preconditions.canLoadFolders([folder]);
    preconditions.canLoadAssets([asset]);
    preconditions.canUpsertRemoteAssets([asset]);
    const [remoteFolder] = preconditions.canCreateRemoteFolders([folder]);
    preconditions.canFetchRemoteFolders([remoteFolder]);
    const assetsDir = resolveCommandPath(directories.assets, DEFAULT_SPACE);
    const ext = path.extname(asset.filename);
    const baseName = `${path.basename(asset.filename, ext)}_${asset.id}`;
    const assetFilePath = path.join(assetsDir, `${baseName}${ext}`);
    const metadataFilePath = path.join(assetsDir, `${baseName}.json`);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup']);

    const files = Object.keys(vol.toJSON()).filter(filename => filename.startsWith(`${assetsDir}${path.sep}`));
    const cleanedFiles = files.filter((filename) => {
      return filename.endsWith('.json') || filename.endsWith('.png');
    });

    expect(files).not.toContain(assetFilePath);
    expect(files).not.toContain(metadataFilePath);
    expect(cleanedFiles).toEqual([]);
  });

  it('should successfully push an external asset when the local directory structure is empty', async () => {
    const externalUrl = 'https://example.com/image.png';
    preconditions.canDownloadExternalAsset(externalUrl);
    const asset = makeMockAsset({
      short_filename: 'image.png',
      asset_folder_id: 123,
    });
    preconditions.canUpsertRemoteAssets([asset]);

    await assetsCommand.parseAsync([
      'node',
      'test',
      'push',
      '--space',
      DEFAULT_SPACE,
      externalUrl,
      '--data',
      '{"meta_data":{"alt":"Hero image","alt__i18n__de":"Hero Bild"}}',
      '--short-filename',
      'image.png',
      '--folder',
      '123',
    ]);

    const logFile = getLogFileContents(LOG_PREFIX);
    expect(logFile).not.toContain('ENOENT');
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 processed, 0 assets failed'));
  });

  it('should filter stories using search parameter when updating a single asset', async () => {
    const localAssetFilename = 'search-me.png';
    const localAssetPath = path.join(tmpdir(), localAssetFilename);
    const pngBuffer = makePngBuffer(10, 10);
    preconditions.canLoadLocalFile(localAssetPath, pngBuffer);
    const localAsset = makeMockAsset({ short_filename: localAssetFilename });
    const pageComponent = makeMockComponent({
      name: 'page',
      schema: {
        asset: {
          type: 'asset',
        },
      },
    });
    preconditions.canLoadComponents([pageComponent]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset]);
    preconditions.canDownloadAssets([remoteAsset]);
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canFetchRemoteStoryPages([]);

    await assetsCommand.parseAsync([
      'node',
      'test',
      'push',
      '--space',
      DEFAULT_SPACE,
      '--data',
      `{"id":${localAsset.id},"meta_data":{"alt":"new alt"}}`,
      '--update-stories',
      localAssetPath,
    ]);

    expect(storyActions.fetchStories).toHaveBeenCalledWith(DEFAULT_SPACE, expect.objectContaining({
      reference_search: localAsset.filename,
    }));
  });
});
