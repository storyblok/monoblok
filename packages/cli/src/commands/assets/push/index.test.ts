import { randomUUID } from 'node:crypto';
import type { Buffer } from 'node:buffer';
import { basename, dirname, extname, join, sep } from 'pathe';
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
import { normalizeAssetUrl } from '@storyblok/management-api-client';
import { getProgram } from '../../../program';
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
vi.spyOn(actions, 'createSharedAsset');
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
  http.get('https://mapi.storyblok.com/v1/spaces/:spaceId/internal_tags', () => HttpResponse.json(
    { internal_tags: [] },
    { headers: { 'Total': '0', 'Per-Page': '100' } },
  )),
);

const preconditions = {
  canLoadComponents(components: MockComponent[], space = DEFAULT_SPACE, basePath?: string) {
    const componentsDir = resolveCommandPath(directories.components, space, basePath);
    vol.fromJSON(Object.fromEntries(components.map(c => [
      join(componentsDir, `${c.name}.json`),
      JSON.stringify(c),
    ])));
  },
  canLoadAssets(assets: MockAsset[], {
    space = DEFAULT_SPACE,
    basePath,
  }: { space?: string; basePath?: string } = {}) {
    const assetsDir = resolveCommandPath(directories.assets, space, basePath);
    const files = assets.map(asset => [
      join(assetsDir, getAssetBinaryFilename(asset)),
      'binary-content',
    ]);
    const metadataFiles = assets.map(asset => [
      join(assetsDir, getAssetFilename(asset)),
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
      [join(assetsDir, 'broken.png')]: 'binary-content',
      [join(assetsDir, 'broken.json')]: '{invalid json',
    });
  },
  canLoadAssetsManifest(manifestEntries: Record<number | string, number | string>[], {
    space = DEFAULT_SPACE,
    basePath,
  }: { space?: string; basePath?: string } = {}) {
    const manifestPath = join(resolveCommandPath(directories.assets, space, basePath), 'manifest.jsonl');
    vol.mkdirSync(dirname(manifestPath), { recursive: true });
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
    const manifestPath = join(resolveCommandPath(directories.assets, space, basePath), 'folders', 'manifest.jsonl');
    vol.mkdirSync(dirname(manifestPath), { recursive: true });
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
        join(assetsDir, 'folders', getFolderFilename(folder)),
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
  hasAssetInternalTags(tags: Array<{ id: number; name: string }>, { space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/internal_tags`, () => HttpResponse.json(
        { internal_tags: tags },
        { headers: { 'Total': String(tags.length), 'Per-Page': '100' } },
      )),
    );
  },
  canCreateAssetInternalTags({ space = DEFAULT_SPACE, idByName = {} }: { space?: string; idByName?: Record<string, number> } = {}) {
    const spy = vi.fn();
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/internal_tags`, async ({ request }) => {
        const body = await request.json() as { name: string; object_type?: string };
        spy(body);
        return HttpResponse.json(
          { internal_tag: { id: idByName[body.name] ?? getID(), name: body.name, object_type: body.object_type } },
          { status: 201 },
        );
      }),
    );
    return spy;
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

        const match = remoteAssets.find(a => basename(a.filename) === requestedFilename);
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

        const match = remoteAssets.find(a => basename(a.filename) === filename);
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
      http.put(`https://mapi.storyblok.com/v1/spaces/${space}/assets/:assetId`, async ({ params, request }) => {
        const match = remoteAssets.find(asset => String(asset.id) === String(params.assetId));
        if (!match) {
          return HttpResponse.json({ message: 'Asset not found' }, { status: 404 });
        }
        const body = await request.json() as { asset?: Record<string, unknown> };
        updateSpy(body.asset ?? {});
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
  hasLibraries(libraries: { id: number; name: string; accessLevel: 'read' | 'write' }[], { space = DEFAULT_SPACE }: { space?: string } = {}) {
    server.use(
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/shared_asset_folders`, () =>
        HttpResponse.json({
          shared_asset_folders: libraries.map(library => ({
            id: library.id,
            name: library.name,
            parent_id: null,
            uuid: `u${library.id}`,
            asset_folder_access: [{ space_id: Number(space), access_level: library.accessLevel }],
          })),
        })),
    );
  },
  canUpsertSharedAssets(assets: MockAsset[], {
    space = DEFAULT_SPACE,
    libraryId = 7,
  }: { space?: string; libraryId?: number } = {}) {
    const sourceName = (asset: MockAsset) => asset.short_filename ?? basename(asset.filename);
    const remoteAssets = assets.map(asset => ({
      ...asset,
      id: getID(),
      filename: `https://a.storyblok.com/g/1/${sourceName(asset)}`,
      asset_folder_id: asset.asset_folder_id ?? libraryId,
    }));
    server.use(
      // Step 1: sign (shared uses query params for filename).
      http.post(`https://mapi.storyblok.com/v1/spaces/${space}/shared_assets`, ({ request }) => {
        const filename = new URL(request.url).searchParams.get('filename');
        const index = assets.findIndex(asset => sourceName(asset) === filename);
        if (index === -1) {
          return HttpResponse.json({ message: 'Error uploading shared asset' }, { status: 500 });
        }
        return HttpResponse.json({
          post_url: 'https://s3.amazonaws.com/a.storyblok.com',
          fields: { key: `g/1/${filename}` },
          id: remoteAssets[index].id,
        });
      }),
      // Step 2: upload to S3 (generic).
      http.post('https://s3.amazonaws.com/a.storyblok.com', async ({ request }) => {
        const form = await request.formData();
        return HttpResponse.json({ key: form.get('key') });
      }),
      // Step 3: finish upload.
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/shared_assets/:assetId/finish_upload`, () =>
        HttpResponse.json({ message: 'Upload finalized' })),
      // Step 4: retrieve + metadata update target.
      http.get(`https://mapi.storyblok.com/v1/spaces/${space}/shared_assets/:assetId`, ({ params }) => {
        const match = remoteAssets.find(asset => String(asset.id) === String(params.assetId));
        if (!match) {
          return HttpResponse.json({ message: 'Asset not found' }, { status: 404 });
        }
        return HttpResponse.json(match);
      }),
      http.put(`https://mapi.storyblok.com/v1/spaces/${space}/shared_assets/:assetId`, () => HttpResponse.json({})),
    );
    return remoteAssets;
  },
};

const parseManifest = async (space: string = DEFAULT_SPACE, basePath?: string) => {
  const manifestPath = join(resolveCommandPath(directories.assets, space, basePath), 'manifest.jsonl');
  return loadManifest(manifestPath);
};

const parseFoldersManifest = async (space: string = DEFAULT_SPACE, basePath?: string) => {
  const manifestPath = join(resolveCommandPath(directories.assets, space, basePath), 'folders', 'manifest.jsonl');
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
    getProgram().setOptionValueWithSource('path', undefined, 'default');
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
    expect(await parseFoldersManifest()).toEqual([
      { old_id: folder.id, new_id: remoteFolder.id, created_at: expect.any(String) },
    ]);
    expect(await parseManifest()).toEqual([
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
    expect(logFile).toContain('"assetResults":{"total":1,"succeeded":1,"failed":0}');
    // UI
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 processed, 0 assets failed'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Folders: 1/1 succeeded, 0 failed.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Assets: 1/1 succeeded, 0 failed.'));
    expect(process.exitCode).toBe(0);
  });

  it('pushes from a non-numeric source directory (e.g. seed staging "qa-seed")', async () => {
    const targetSpace = '54321';
    const asset = makeMockAsset();
    // Local source subtree keyed by a non-numeric directory name. The source identifier is a directory, not a space ID.
    preconditions.canLoadAssets([asset], { space: 'qa-seed' });
    preconditions.canUpsertRemoteAssets([asset], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', 'qa-seed', '--space', targetSpace]);

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 processed, 0 assets failed'));
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
              filename: normalizeAssetUrl(remoteAsset.filename),
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
        assetResults: { total: 1, succeeded: 1, failed: 0 },
        fetchStoryPages: { total: 1, succeeded: 1, failed: 0 },
        fetchStories: { total: 1, succeeded: 1, failed: 0 },
        storyProcessResults: { total: 1, succeeded: 1, failed: 0 },
        storyUpdateResults: { total: 1, succeeded: 1, failed: 0 },
      },
    });
    // UI
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 processed, 0 assets failed'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Assets: 1/1 succeeded, 0 failed.'));
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
        assetResults: { total: 1, succeeded: 1, failed: 0 },
      },
    });
    // UI
    expect(storyActions.updateStory).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('Push results: 1 processed, 0 assets failed'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'));
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Assets: 1/1 succeeded, 0 failed.'));
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

    const program = getProgram();
    program.setOptionValueWithSource('path', customPath, 'cli');
    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

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
    expect(actions.updateAssetFolder).toHaveBeenCalledWith(remoteFolder.id, expect.objectContaining({
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
    expect(actions.updateAssetFolder).toHaveBeenCalledWith(remoteFolder.id, expect.objectContaining({
      name: remoteFolder.name,
    }), expect.anything());
    expect(await parseFoldersManifest()).toEqual([
      { old_id: localFolder.id, new_id: remoteFolder.id, created_at: expect.any(String) },
    ]);
  });

  it('should log an error and stop when manifest loading fails', async () => {
    const manifestPath = join(resolveCommandPath(directories.assets, DEFAULT_SPACE), 'manifest.jsonl');
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
      expect.stringContaining('Assets: 0/1 succeeded, 1 failed.'),
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
    expect(logFile).toContain('Invalid sidecar JSON');
    // UI
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Push results: 1 processed, 1 assets failed'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Assets: 0/1 succeeded, 1 failed.'),
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
    expect(logFile).toContain('The server returned an error');
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
    expect(logFile).toContain('The server returned an error');
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
    expect(logFile).toContain('The server returned an error');
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Push results: 1 processed, 1 assets failed'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Assets: 0/1 succeeded, 1 failed.'),
    );
    expect(process.exitCode).toBe(1);
  });

  it('should handle errors when updating assets fails', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset]);
    preconditions.canFetchRemoteAssets([remoteAsset]);
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
    expect(logFile).toContain('The server returned an error');
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Push results: 1 processed, 1 assets failed'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Folders: 0/0 succeeded, 0 failed.'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Assets: 0/1 succeeded, 1 failed.'),
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
      expect.stringContaining('Assets: 0/1 succeeded, 1 failed.'),
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

  it('should always upload when updating an existing asset', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const finishUploadSpy = vi.fn();
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { finishUploadSpy });
    preconditions.canFetchRemoteAssets([remoteAsset]);

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

  it('should upload when resuming from manifest', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const finishUploadSpy = vi.fn();
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { finishUploadSpy });
    preconditions.canFetchRemoteAssets([remoteAsset]);
    preconditions.canLoadAssetsManifest([{
      old_id: localAsset.id,
      old_filename: localAsset.filename,
      new_id: remoteAsset.id,
      new_filename: 'https://a.storyblok.com/f/12345/500x500/old-new-filename.png',
    }]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(finishUploadSpy).toHaveBeenCalled();
    expect(await parseManifest()).toEqual([{
      old_id: localAsset.id,
      old_filename: localAsset.filename,
      new_id: remoteAsset.id,
      new_filename: remoteAsset.filename,
      created_at: expect.any(String),
    }]);
  });

  it('should update existing remote assets even when no manifest exists', async () => {
    const localAsset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset]);
    preconditions.canFetchRemoteAssets([remoteAsset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).not.toHaveBeenCalled();
    expect(actions.updateAsset).toHaveBeenCalledWith(remoteAsset.id, expect.anything(), expect.anything());
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

  it('should clean up binary and sidecar json when pushing a single local asset with --cleanup', async () => {
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

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup', assetPath]);

    expect(vol.toJSON()[assetPath]).toBeUndefined();
    expect(vol.toJSON()[assetJsonPath]).toBeUndefined();
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
    const asset = makeMockAsset({ short_filename: basename(externalUrl) });
    preconditions.canUpsertRemoteAssets([asset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup', externalUrl]);

    const tempRoot = join(tmpdir(), 'storyblok-assets');
    const tempFiles = Object.keys(vol.toJSON()).filter(filename => filename.startsWith(`${tempRoot}/`));
    expect(tempFiles).toEqual([]);
  });

  it('should not end up with duplicate entries in the manifest after multiple runs', async () => {
    const targetSpace = '54321';
    const asset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([asset], { space: targetSpace });
    preconditions.canFetchRemoteAssets([remoteAsset], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);
    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    expect(await parseManifest()).toHaveLength(1);
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
    const ext = extname(asset.filename);
    const baseName = `${basename(asset.filename, ext)}_${asset.id}`;
    const assetBinaryPath = join(assetsDir, `${baseName}${ext}`);
    const assetPath = join(assetsDir, `${baseName}.json`);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--cleanup']);

    const files = Object.keys(vol.toJSON()).filter(filename => filename.startsWith(`${assetsDir}${sep}`));
    const cleanedFiles = files.filter((filename) => {
      return filename.endsWith('.json') || filename.endsWith('.png');
    });

    expect(files).not.toContain(assetBinaryPath);
    expect(files).not.toContain(assetPath);
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

  it('should push user-defined assets that have short_filename but no filename', async () => {
    const assetsDir = resolveCommandPath(directories.assets, DEFAULT_SPACE);
    // User-defined metadata: has short_filename but no filename (e.g. CMS migration)
    const userAssetMetadata = { short_filename: 'hero.png', alt: 'Hero image' };
    vol.fromJSON({
      [join(assetsDir, 'hero.json')]: JSON.stringify(userAssetMetadata),
      [join(assetsDir, 'hero.png')]: 'binary-content',
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssetsManifest([]);
    preconditions.canLoadFoldersManifest([]);

    const remoteAsset = makeMockAsset({ short_filename: 'hero.png' });
    preconditions.canUpsertRemoteAssets([remoteAsset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ short_filename: 'hero.png' }),
      expect.anything(),
      expect.anything(),
    );
    expect(process.exitCode).toBe(0);
  });

  it('should derive short_filename from filename CDN URL when short_filename is not present', async () => {
    const assetsDir = resolveCommandPath(directories.assets, DEFAULT_SPACE);
    const userAssetMetadata = { filename: 'https://a.storyblok.com/f/12345/500x500/hero.png', alt: 'Hero' };
    vol.fromJSON({
      [join(assetsDir, 'hero.json')]: JSON.stringify(userAssetMetadata),
      [join(assetsDir, 'hero.png')]: 'binary-content',
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssetsManifest([]);
    preconditions.canLoadFoldersManifest([]);

    const remoteAsset = makeMockAsset({ short_filename: 'hero.png' });
    preconditions.canUpsertRemoteAssets([remoteAsset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ short_filename: 'hero.png' }),
      expect.anything(),
      expect.anything(),
    );
    expect(process.exitCode).toBe(0);
  });

  it('should derive short_filename from companion binary when metadata has neither filename nor short_filename', async () => {
    const assetsDir = resolveCommandPath(directories.assets, DEFAULT_SPACE);
    // User-defined metadata: no filename, no short_filename (bare metadata)
    const userAssetMetadata = { alt: 'Hero image', title: 'My hero' };
    vol.fromJSON({
      [join(assetsDir, 'hero.json')]: JSON.stringify(userAssetMetadata),
      [join(assetsDir, 'hero.png')]: 'binary-content',
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssetsManifest([]);
    preconditions.canLoadFoldersManifest([]);

    const remoteAsset = makeMockAsset({ short_filename: 'hero.png' });
    preconditions.canUpsertRemoteAssets([remoteAsset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ short_filename: 'hero.png', alt: 'Hero image' }),
      expect.anything(),
      expect.anything(),
    );
    expect(process.exitCode).toBe(0);
  });

  it('should push a binary-only asset with no sidecar JSON using its filename as short_filename', async () => {
    const assetsDir = resolveCommandPath(directories.assets, DEFAULT_SPACE);
    vol.fromJSON({
      [join(assetsDir, 'hero.png')]: 'binary-content',
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssetsManifest([]);
    preconditions.canLoadFoldersManifest([]);

    const remoteAsset = makeMockAsset({ short_filename: 'hero.png' });
    preconditions.canUpsertRemoteAssets([remoteAsset]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE]);

    expect(actions.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ short_filename: 'hero.png' }),
      expect.anything(),
      expect.anything(),
    );
    expect(process.exitCode).toBe(0);
  });

  it('should filter stories using search parameter when updating a single asset', async () => {
    const localAssetFilename = 'search-me.png';
    const localAssetPath = join(tmpdir(), localAssetFilename);
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

  it('should translate source-space internal_tag_ids to target-space tag IDs by sidecar tag name', async () => {
    const targetSpace = '54321';
    const sourceTagId = 111;
    const targetTagId = 999;
    const asset = makeMockAsset({
      internal_tag_ids: [String(sourceTagId)],
      internal_tags_list: [{ id: sourceTagId, name: 'shared-tag' }],
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.hasAssetInternalTags(
      [{ id: sourceTagId, name: 'stale-source-name' }],
      { space: DEFAULT_SPACE },
    );
    preconditions.hasAssetInternalTags(
      [{ id: targetTagId, name: 'shared-tag' }],
      { space: targetSpace },
    );
    preconditions.canUpsertRemoteAssets([asset], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    expect(actions.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ internal_tag_ids: [String(targetTagId)] }),
      expect.anything(),
      expect.anything(),
    );
    const createPayload = (actions.createAsset as unknown as Mock).mock.calls[0][0];
    expect(createPayload).not.toHaveProperty('internal_tags_list');
    expect(process.exitCode).not.toBe(1);
  });

  it('should translate source-space internal_tag_ids when updating an existing target asset', async () => {
    const targetSpace = '54321';
    const sourceTagId = 112;
    const targetTagId = 998;
    const localAsset = makeMockAsset({
      internal_tag_ids: [String(sourceTagId)],
      internal_tags_list: [{ id: sourceTagId, name: 'shared-tag' }],
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([localAsset]);
    preconditions.hasAssetInternalTags(
      [{ id: targetTagId, name: 'shared-tag' }],
      { space: targetSpace },
    );
    const updateSpy = vi.fn();
    const [remoteAsset] = preconditions.canUpsertRemoteAssets([localAsset], { updateSpy, space: targetSpace });
    preconditions.canFetchRemoteAssets([remoteAsset], { space: targetSpace });
    preconditions.canLoadAssetsManifest([{
      old_id: localAsset.id,
      old_filename: localAsset.filename,
      new_id: remoteAsset.id,
      new_filename: remoteAsset.filename,
    }]);

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    expect(actions.updateAsset).toHaveBeenCalledWith(
      remoteAsset.id,
      expect.objectContaining({ internal_tag_ids: [String(targetTagId)] }),
      expect.anything(),
    );
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
      internal_tag_ids: [String(targetTagId)],
    }));
    expect(process.exitCode).not.toBe(1);
  });

  it('should omit internal_tag_ids from the create payload when the source has no tag metadata', async () => {
    const targetSpace = '54321';
    const asset = makeMockAsset();
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.canUpsertRemoteAssets([asset], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    const createPayload = (actions.createAsset as unknown as Mock).mock.calls[0][0];
    expect(createPayload).not.toHaveProperty('internal_tag_ids');
    expect(createPayload).not.toHaveProperty('internal_tags_list');
    expect(process.exitCode).not.toBe(1);
  });

  it('should create internal tags missing from the target space and map to the new tag ID', async () => {
    const targetSpace = '54321';
    const sourceTagId = 222;
    const createdTagId = 7777;
    const asset = makeMockAsset({
      internal_tag_ids: [String(sourceTagId)],
      internal_tags_list: [{ id: sourceTagId, name: 'missing-tag' }],
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.hasAssetInternalTags([], { space: targetSpace });
    const createTagSpy = preconditions.canCreateAssetInternalTags({
      space: targetSpace,
      idByName: { 'missing-tag': createdTagId },
    });
    preconditions.canUpsertRemoteAssets([asset], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    expect(createTagSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'missing-tag', object_type: 'asset' }),
    );
    expect(actions.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ internal_tag_ids: [String(createdTagId)] }),
      expect.anything(),
      expect.anything(),
    );
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Created 1 internal asset tag in target space: missing-tag'),
    );
    expect(process.exitCode).not.toBe(1);
  });

  it('should drop internal tag IDs without sidecar tag metadata with an ID warning', async () => {
    const targetSpace = '54321';
    const sourceTagId = 333;
    const asset = makeMockAsset({
      internal_tag_ids: [String(sourceTagId)],
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.hasAssetInternalTags(
      [{ id: 999, name: 'shared-tag' }],
      { space: targetSpace },
    );
    preconditions.canUpsertRemoteAssets([asset], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    expect(actions.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ internal_tag_ids: [] }),
      expect.anything(),
      expect.anything(),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropped 1 unknown internal asset tag not present in target space: #333'),
    );
    expect(process.exitCode).not.toBe(1);
  });

  it('should drop the tag reference and not fail the push when creating a missing tag fails', async () => {
    const targetSpace = '54321';
    const sourceTagId = 444;
    const asset = makeMockAsset({
      internal_tag_ids: [String(sourceTagId)],
      internal_tags_list: [{ id: sourceTagId, name: 'uncreatable-tag' }],
    });
    preconditions.canLoadFolders([]);
    preconditions.canLoadAssets([asset]);
    preconditions.hasAssetInternalTags([], { space: targetSpace });
    server.use(
      http.post(`https://mapi.storyblok.com/v1/spaces/${targetSpace}/internal_tags`, () =>
        HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );
    preconditions.canUpsertRemoteAssets([asset], { space: targetSpace });

    await assetsCommand.parseAsync(['node', 'test', 'push', '--from', DEFAULT_SPACE, '--space', targetSpace]);

    expect(actions.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({ internal_tag_ids: [] }),
      expect.anything(),
      expect.anything(),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropped 1 unknown internal asset tag not present in target space: uncreatable-tag'),
    );
    expect(process.exitCode).not.toBe(1);
  });

  describe('shared library targets', () => {
    it('pushes a single asset to a library (--target shared --library)', async () => {
      preconditions.hasLibraries([{ id: 7, name: 'Brand', accessLevel: 'write' }]);
      preconditions.canUpsertSharedAssets([makeMockAsset({ short_filename: 'hero.png', filename: 'hero.png' })], { libraryId: 7 });
      preconditions.canLoadLocalFile('./hero.png', 'binary-content');

      await assetsCommand.parseAsync(['node', 'test', 'push', './hero.png', '--space', DEFAULT_SPACE, '--target', 'shared', '--library', '7']);

      // Without --folder, the asset folder must default to the library root,
      // otherwise shared-asset creation 403s.
      expect(actions.createSharedAsset).toHaveBeenCalledWith(
        expect.objectContaining({ asset_folder_id: 7 }),
        expect.anything(),
        expect.anything(),
      );
      expect(process.exitCode).toBe(0);
    });

    it('defaults a bulk shared-asset folder to the library root when the sidecar omits it', async () => {
      preconditions.hasLibraries([{ id: 7, name: 'Brand', accessLevel: 'write' }]);
      preconditions.canUpsertSharedAssets([makeMockAsset({ short_filename: 'x.png', filename: 'x.png' })], { libraryId: 7 });
      const dir = resolveCommandPath(directories.assets, join('shared', '7'));
      vol.fromJSON({
        [join(dir, 'x_2.png')]: 'binary',
        [join(dir, 'x_2.json')]: JSON.stringify({ id: 2, short_filename: 'x.png', filename: 'x.png' }),
      });

      await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--target', 'shared']);

      expect(actions.createSharedAsset).toHaveBeenCalledWith(
        expect.objectContaining({ asset_folder_id: 7 }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('rejects a single-asset --target shared without --library', async () => {
      preconditions.canLoadLocalFile('./hero.png', 'binary-content');

      await assetsCommand.parseAsync(['node', 'test', 'push', './hero.png', '--space', DEFAULT_SPACE, '--target', 'shared']);

      expect(actions.createSharedAsset).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(2);
    });

    it('rejects a single-asset --target all', async () => {
      preconditions.canLoadLocalFile('./hero.png', 'binary-content');

      await assetsCommand.parseAsync(['node', 'test', 'push', './hero.png', '--space', DEFAULT_SPACE, '--target', 'all']);

      expect(actions.createAsset).not.toHaveBeenCalled();
      expect(actions.createSharedAsset).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(2);
    });

    it('rejects an invalid --target value', async () => {
      const push = assetsCommand.commands.find(command => command.name() === 'push')!;
      push.exitOverride();

      await expect(
        assetsCommand.parseAsync(['node', 'test', 'push', './hero.png', '--space', DEFAULT_SPACE, '--target', 'bogus']),
      ).rejects.toThrow(/Allowed choices/i);
    });

    it('rejects --library combined with --target space', async () => {
      preconditions.canLoadLocalFile('./hero.png', 'binary-content');

      await assetsCommand.parseAsync(['node', 'test', 'push', './hero.png', '--space', DEFAULT_SPACE, '--target', 'space', '--library', '7']);

      expect(actions.createSharedAsset).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(2);
    });

    it('fails fast pushing to a read-only library', async () => {
      preconditions.hasLibraries([{ id: 8, name: 'Locked', accessLevel: 'read' }]);
      preconditions.canLoadLocalFile('./hero.png', 'binary-content');

      await assetsCommand.parseAsync(['node', 'test', 'push', './hero.png', '--space', DEFAULT_SPACE, '--target', 'shared', '--library', '8']);

      expect(actions.createSharedAsset).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(2);
      expect(getLogFileContents(LOG_PREFIX)).toMatch(/Locked/);
    });

    it('bulk --target=all processes the space subtree and each writable library', async () => {
      const spaceAsset = makeMockAsset({ short_filename: 'space.png' });
      const libraryAsset = makeMockAsset({ short_filename: 'lib.png' });
      preconditions.hasLibraries([{ id: 7, name: 'Brand', accessLevel: 'write' }]);
      preconditions.canLoadAssets([spaceAsset]);
      preconditions.canLoadAssets([libraryAsset], { space: join('shared', '7') });
      preconditions.canUpsertRemoteAssets([spaceAsset]);
      preconditions.canUpsertSharedAssets([libraryAsset], { libraryId: 7 });

      await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--target', 'all']);

      const written = Object.keys(vol.toJSON()).map(p => p.replace(/\\/g, '/'));
      expect(written.some(p => p.includes('assets/12345/manifest.jsonl'))).toBe(true);
      expect(written.some(p => p.includes('assets/shared/7/manifest.jsonl'))).toBe(true);
    });

    it('skips the library root folder on bulk push, still pushes child folders', async () => {
      preconditions.hasLibraries([{ id: 7, name: 'Brand', accessLevel: 'write' }]);
      preconditions.canUpsertSharedAssets([], { libraryId: 7 });
      let rootFolderTouched = false;
      let childFolderCreated = false;
      server.use(
        // The root (library) folder exists server-side; updating it from a
        // space 403s. The child folder does not exist yet (create path).
        http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders/7', () => {
          rootFolderTouched = true;
          return HttpResponse.json({ shared_asset_folder: { id: 7, name: 'Brand', parent_id: null } });
        }),
        http.put('https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders/7', () => {
          rootFolderTouched = true;
          return HttpResponse.json({ message: 'Cannot update shared root asset folder in space context' }, { status: 403 });
        }),
        http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders/8', () =>
          HttpResponse.json({ message: 'not found' }, { status: 404 })),
        http.post('https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders', async ({ request }) => {
          childFolderCreated = true;
          const body = await request.json() as { shared_asset_folder: { name: string; parent_id?: number } };
          return HttpResponse.json({ shared_asset_folder: { id: 80, name: body.shared_asset_folder.name, parent_id: body.shared_asset_folder.parent_id } });
        }),
      );
      const dir = resolveCommandPath(directories.assets, join('shared', '7'));
      vol.fromJSON({
        [join(dir, 'folders', 'Brand_7.json')]: JSON.stringify({ id: 7, name: 'Brand', parent_id: null, uuid: 'u7' }),
        [join(dir, 'folders', 'Sub_8.json')]: JSON.stringify({ id: 8, name: 'Sub', parent_id: 7, uuid: 'u8' }),
      });

      await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--target', 'shared']);

      expect(rootFolderTouched).toBe(false);
      expect(childFolderCreated).toBe(true);
      expect(process.exitCode).toBe(0);
    });

    it('updates an existing child library folder with only whitelisted fields', async () => {
      // A pull→push round-trip writes child sidecars carrying their id and the
      // org-managed `asset_folder_access`/`regions`. The space may update such a
      // folder, but only its name/parent — forwarding the access grant 403s.
      preconditions.hasLibraries([{ id: 7, name: 'Brand', accessLevel: 'write' }]);
      preconditions.canUpsertSharedAssets([], { libraryId: 7 });
      let updatePayload: Record<string, unknown> | undefined;
      server.use(
        // Child folder 8 already exists server-side → the push takes the update path.
        http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders/8', () =>
          HttpResponse.json({ shared_asset_folder: { id: 8, name: 'Sub', parent_id: 7 } })),
        http.put('https://mapi.storyblok.com/v1/spaces/12345/shared_asset_folders/8', async ({ request }) => {
          updatePayload = ((await request.json()) as { shared_asset_folder: Record<string, unknown> }).shared_asset_folder;
          // The backend rejects org-managed fields from space context.
          if ('asset_folder_access' in updatePayload) {
            return HttpResponse.json({ message: 'Forbidden' }, { status: 403 });
          }
          return new HttpResponse(null, { status: 204 });
        }),
      );
      const dir = resolveCommandPath(directories.assets, join('shared', '7'));
      vol.fromJSON({
        [join(dir, 'folders', 'Brand_7.json')]: JSON.stringify({ id: 7, name: 'Brand', parent_id: null, uuid: 'u7', asset_folder_access: [{ space_id: 12345, access_level: 'write' }], regions: ['eu'] }),
        [join(dir, 'folders', 'Sub_8.json')]: JSON.stringify({ id: 8, name: 'Sub', parent_id: 7, uuid: 'u8', asset_folder_access: [{ space_id: 12345, access_level: 'write' }], regions: [] }),
      });

      await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--target', 'shared']);

      expect(updatePayload).toEqual({ name: 'Sub', parent_id: 7 });
      expect(process.exitCode).toBe(0);
    });

    it('round-trips meta_data for a shared asset', async () => {
      preconditions.hasLibraries([{ id: 7, name: 'Brand', accessLevel: 'write' }]);
      preconditions.canUpsertSharedAssets([makeMockAsset({ short_filename: 'x.png', filename: 'x.png' })], { libraryId: 7 });
      let capturedPut: { asset?: { meta_data?: unknown; internal_tag_ids?: string[] } } | undefined;
      server.use(http.put('https://mapi.storyblok.com/v1/spaces/12345/shared_assets/:assetId', async ({ request }) => {
        capturedPut = await request.json() as typeof capturedPut;
        return HttpResponse.json({});
      }));
      const dir = resolveCommandPath(directories.assets, join('shared', '7'));
      vol.fromJSON({
        [join(dir, 'x_2.png')]: 'binary',
        [join(dir, 'x_2.json')]: JSON.stringify({ id: 2, short_filename: 'x.png', filename: 'x.png', meta_data: { credit: 'ACME' } }),
      });

      await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--target', 'shared']);

      expect(capturedPut?.asset?.meta_data).toEqual({ credit: 'ACME' });
    });

    it('creates missing library tags and remaps internal_tag_ids on push', async () => {
      preconditions.hasLibraries([{ id: 7, name: 'Brand', accessLevel: 'write' }]);
      preconditions.canUpsertSharedAssets([makeMockAsset({ short_filename: 'x.png', filename: 'x.png' })], { libraryId: 7 });
      let capturedPut: { asset?: { internal_tag_ids?: string[] } } | undefined;
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/12345/shared_internal_tags', () => HttpResponse.json({ internal_tags: [] })),
        http.post('https://mapi.storyblok.com/v1/spaces/12345/shared_internal_tags', () => HttpResponse.json({ internal_tag: { id: 500, name: 'hero', object_type: 'asset' } })),
        http.put('https://mapi.storyblok.com/v1/spaces/12345/shared_assets/:assetId', async ({ request }) => {
          capturedPut = await request.json() as typeof capturedPut;
          return HttpResponse.json({});
        }),
      );
      const dir = resolveCommandPath(directories.assets, join('shared', '7'));
      vol.fromJSON({
        [join(dir, 'x_2.png')]: 'binary',
        [join(dir, 'x_2.json')]: JSON.stringify({ id: 2, short_filename: 'x.png', filename: 'x.png', internal_tag_ids: ['300'], internal_tags_list: [{ id: 300, name: 'hero' }] }),
      });

      await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--target', 'shared']);

      expect(capturedPut?.asset?.internal_tag_ids).toEqual(['500']);
    });

    it('bulk --target=space ignores shared subtrees', async () => {
      const spaceAsset = makeMockAsset({ short_filename: 'space.png' });
      const libraryAsset = makeMockAsset({ short_filename: 'lib.png' });
      preconditions.canLoadAssets([spaceAsset]);
      preconditions.canLoadAssets([libraryAsset], { space: join('shared', '7') });
      preconditions.canUpsertRemoteAssets([spaceAsset]);

      await assetsCommand.parseAsync(['node', 'test', 'push', '--space', DEFAULT_SPACE, '--target', 'space']);

      const written = Object.keys(vol.toJSON()).map(p => p.replace(/\\/g, '/'));
      expect(written.some(p => p.includes('assets/shared/7/manifest.jsonl'))).toBe(false);
    });
  });
});
