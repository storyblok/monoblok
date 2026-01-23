import { Buffer } from 'node:buffer';
import { basename, extname, join, parse } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { appendToFile, saveToFile } from '../../utils/filesystem';
import { toError } from '../../utils/error/error';
import type { RegionCode } from '../../constants';
import { createAsset, createAssetFolder, downloadAssetFile, downloadFile, fetchAssetFolders, fetchAssets, sha256, updateAsset, updateAssetFolder } from './actions';
import type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderMap, AssetFolderUpdate, AssetMap, AssetsQueryParams, AssetUpdate, AssetUpload } from './types';
import { mapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';
import { FetchError } from '../../utils/fetch';
import { getAssetBinaryFilename, getAssetFilename, getFolderFilename, isRemoteSource } from './utils';

const apiConcurrencyLock = new Sema(12);

export const fetchAssetsStream = ({
  spaceId,
  params = {},
  setTotalAssets,
  setTotalPages,
  onIncrement,
  onPageSuccess,
  onPageError,
}: {
  spaceId: string;
  params?: AssetsQueryParams;
  setTotalAssets?: (total: number) => void;
  setTotalPages?: (totalPages: number) => void;
  onIncrement?: () => void;
  onPageSuccess?: (page: number, total: number) => void;
  onPageError?: (error: Error, page: number, total: number) => void;
}) => {
  const listGenerator = async function* assetListIterator() {
    let perPage = 100;
    let page = 1;
    let totalPages = 1;
    setTotalPages?.(totalPages);

    while (page <= totalPages) {
      try {
        const result = await fetchAssets({
          spaceId,
          params: {
            ...params,
            per_page: perPage,
            page,
          },
        });

        const { headers, assets } = result;
        const total = Number(headers.get('Total'));
        perPage = Number(headers.get('Per-Page')) || perPage;
        totalPages = Math.max(1, Math.ceil(total / perPage));
        setTotalAssets?.(total);
        setTotalPages?.(totalPages);
        onPageSuccess?.(page, totalPages);

        for (const asset of assets) {
          yield asset;
        }

        page += 1;
      }
      catch (maybeError) {
        onPageError?.(toError(maybeError), page, totalPages);
        break;
      }
      finally {
        onIncrement?.();
      }
    }
  };

  return Readable.from(listGenerator());
};

export const downloadAssetStream = ({
  assetToken,
  region,
  onIncrement,
  onAssetSuccess,
  onAssetError,
}: {
  assetToken?: string;
  region?: RegionCode;
  onIncrement?: () => void;
  onAssetSuccess?: (asset: Asset) => void;
  onAssetError?: (error: Error, asset: Asset) => void;
}) => {
  const processing = new Set<Promise<unknown>>();

  return new Transform({
    objectMode: true,
    async transform(asset: Asset, _encoding, callback) {
      await apiConcurrencyLock.acquire();

      const task = downloadAssetFile(asset, { assetToken, region })
        .then((fileBuffer) => {
          if (!fileBuffer) {
            throw new Error('Invalid asset file!');
          }
          onAssetSuccess?.(asset);
          this.push({ asset, fileBuffer });
        })
        .catch((maybeError) => {
          onAssetError?.(toError(maybeError), asset);
        })
        .finally(() => {
          onIncrement?.();
          apiConcurrencyLock.release();
          processing.delete(task);
        });
      processing.add(task);

      callback();
    },
    flush(callback) {
      Promise.allSettled(processing).finally(() => callback());
    },
  });
};

export type WriteAssetTransport = (asset: Asset, fileBuffer: ArrayBuffer) => Promise<Asset>;

export const makeWriteAssetFSTransport = ({ directoryPath }: {
  directoryPath: string;
}): WriteAssetTransport => async (asset, fileBuffer) => {
  const assetBinaryPath = join(directoryPath, getAssetBinaryFilename(asset));
  const assetPath = join(directoryPath, getAssetFilename(asset));
  await saveToFile(assetBinaryPath, Buffer.from(fileBuffer));
  await saveToFile(assetPath, JSON.stringify(asset, null, 2));
  return asset;
};

export const writeAssetStream = ({
  writeAsset,
  onIncrement,
  onAssetSuccess,
  onAssetError,
}: {
  writeAsset: WriteAssetTransport;
  onIncrement?: () => void;
  onAssetSuccess?: (asset: Asset) => void;
  onAssetError?: (error: Error, asset: Asset) => void;
}) => {
  const processing = new Set<Promise<void>>();

  return new Writable({
    objectMode: true,
    async write(payload: { asset: Asset; fileBuffer: ArrayBuffer }, _encoding, callback) {
      await apiConcurrencyLock.acquire();

      const task = (async () => {
        try {
          await writeAsset(payload.asset, payload.fileBuffer);
          onAssetSuccess?.(payload.asset);
        }
        catch (maybeError) {
          onAssetError?.(toError(maybeError), payload.asset);
        }
      })();

      processing.add(task);
      task.finally(() => {
        onIncrement?.();
        apiConcurrencyLock.release();
        processing.delete(task);
      });

      callback();
    },
    final(callback) {
      Promise.all(processing).finally(() => callback());
    },
  });
};

export const fetchAssetFoldersStream = ({
  spaceId,
  setTotalFolders,
  onSuccess,
  onError,
}: {
  spaceId: string;
  setTotalFolders?: (total: number) => void;
  onSuccess?: (folders: AssetFolder[]) => void;
  onError?: (error: Error) => void;
}) => {
  const listGenerator = async function* folderListIterator() {
    try {
      const result = await fetchAssetFolders({ spaceId });
      const { asset_folders } = result;
      const total = asset_folders.length;
      setTotalFolders?.(total);
      onSuccess?.(asset_folders);

      for (const folder of asset_folders) {
        yield folder;
      }
    }
    catch (maybeError) {
      onError?.(toError(maybeError));
    }
  };

  return Readable.from(listGenerator());
};

export type WriteAssetFolderTransport = (folder: AssetFolder) => Promise<AssetFolder>;

export const makeWriteAssetFolderFSTransport = ({ directoryPath }: {
  directoryPath: string;
}): WriteAssetFolderTransport => async (folder) => {
  const filename = getFolderFilename(folder);
  await saveToFile(join(directoryPath, 'folders', filename), JSON.stringify(folder, null, 2));
  return folder;
};

export const writeAssetFolderStream = ({
  writeAssetFolder,
  onIncrement,
  onFolderSuccess,
  onFolderError,
}: {
  writeAssetFolder: WriteAssetFolderTransport;
  onIncrement?: () => void;
  onFolderSuccess?: (folder: AssetFolder) => void;
  onFolderError?: (error: Error, folder: AssetFolder) => void;
}) => {
  const processing = new Set<Promise<void>>();

  return new Writable({
    objectMode: true,
    async write(folder: AssetFolder, _encoding, callback) {
      await apiConcurrencyLock.acquire();

      const task = (async () => {
        try {
          await writeAssetFolder(folder);
          onFolderSuccess?.(folder);
        }
        catch (maybeError) {
          onFolderError?.(toError(maybeError), folder);
        }
      })();

      processing.add(task);
      task.finally(() => {
        onIncrement?.();
        apiConcurrencyLock.release();
        processing.delete(task);
      });

      callback();
    },
    final(callback) {
      Promise.all(processing).finally(() => callback());
    },
  });
};

export interface ReadLocalAssetFolderOptions {
  directoryPath: string;
  setTotalFolders?: (total: number) => void;
  onFolderError?: (error: Error) => void;
}

export interface LocalAssetFolderPayload {
  folder: AssetFolder;
  context: {
    localFilePath: string;
  };
}

export const readLocalAssetFoldersStream = ({
  directoryPath,
  setTotalFolders,
  onFolderError,
}: ReadLocalAssetFolderOptions) => {
  const iterator = async function* readFolders() {
    try {
      const files = await readdir(directoryPath);
      const jsonFiles = new Set(files.filter(file => file.endsWith('.json')));
      setTotalFolders?.(jsonFiles.size);

      const processed = new Set<number>();
      while (jsonFiles.size > 0) {
        for (const file of jsonFiles) {
          try {
            const filePath = join(directoryPath, file);
            const content = await readFile(filePath, 'utf8');
            const folder = JSON.parse(content) as AssetFolder;
            jsonFiles.delete(file);
            // We must ensure the parent folder was already processed before
            // we can pass it to the next step in the pipeline. Otherwise,
            // mapping from local to remote parent ID does not work correctly.
            if (!folder.parent_id || processed.has(folder.parent_id)) {
              processed.add(folder.id);
              yield {
                folder,
                context: {
                  localFilePath: filePath,
                },
              } satisfies LocalAssetFolderPayload;
            }
            // If the parent folder has not been processed yet, we postpone
            // handling of the current folder by moving it to the end of the
            // queue.
            else {
              jsonFiles.add(file);
            }
          }
          catch (maybeError) {
            onFolderError?.(toError(maybeError));
          }
        }
      }
    }
    catch (maybeError) {
      const error = toError(maybeError);
      if ('code' in error && error.code === 'ENOENT') {
        return;
      }
      onFolderError?.(error);
    }
  };
  return Readable.from(iterator());
};

export type CreateAssetFolderTransport = (folder: AssetFolderCreate) => Promise<AssetFolder>;

export const makeCreateAssetFolderAPITransport = ({ spaceId }: {
  spaceId: string;
}): CreateAssetFolderTransport => folder => createAssetFolder({
  name: folder.name,
  parent_id: folder.parent_id ?? undefined,
}, {
  spaceId,
});

export type UpdateAssetFolderTransport = (folder: AssetFolderUpdate) => Promise<AssetFolderUpdate>;

export const makeUpdateAssetFolderAPITransport = ({ spaceId }: {
  spaceId: string;
}): UpdateAssetFolderTransport => folder => updateAssetFolder(folder, { spaceId });

export type GetAssetFolderTransport = (folderId: number) => Promise<AssetFolder | undefined>;

export const makeGetAssetFolderAPITransport = ({ spaceId }: {
  spaceId: string;
}): GetAssetFolderTransport => async (folderId) => {
  const { data, response } = await mapiClient().assetFolders.get({
    path: {
      asset_folder_id: folderId,
      space_id: spaceId,
    },
  });

  if (!response.ok && response.status !== 404) {
    handleAPIError('pull_asset_folder', new FetchError(response.statusText, response));
  }

  return data?.asset_folder;
};

export type CleanupAssetFolderTransport = (context: { localFilePath: string }) => Promise<void>;

export const makeCleanupAssetFolderFSTransport = (): CleanupAssetFolderTransport =>
  async ({ localFilePath }) => await unlink(localFilePath);

export const upsertAssetFolderStream = ({
  transports,
  maps,
  onIncrement,
  onFolderSuccess,
  onFolderError,
}: {
  transports: {
    getAssetFolder: GetAssetFolderTransport;
    createAssetFolder: CreateAssetFolderTransport;
    updateAssetFolder: UpdateAssetFolderTransport;
    appendAssetFolderManifest: AppendAssetFolderManifestTransport;
    cleanupAssetFolder?: CleanupAssetFolderTransport;
  };
  maps: { assetFolders: AssetFolderMap };
  onIncrement?: () => void;
  onFolderSuccess?: (localFolder: AssetFolder, remoteFolder: AssetFolder | AssetFolderUpdate) => void;
  onFolderError?: (error: Error, folder: AssetFolder) => void;
}) => {
  return new Writable({
    objectMode: true,
    async write({ folder, context }: LocalAssetFolderPayload, _encoding, callback) {
      try {
        const remoteParentId = folder.parent_id && (maps.assetFolders.get(folder.parent_id) || folder.parent_id);
        const remoteFolderId = maps.assetFolders.get(folder.id) || folder.id;
        const upsertFolder = {
          ...folder,
          id: remoteFolderId,
          parent_id: remoteParentId,
        };
        // If a remote folder already exists, we must not create a new folder.
        // This can happen when the user resumes a failed push or runs push multiple times.
        const existingRemoteFolder = await transports.getAssetFolder(remoteFolderId);
        const newRemoteFolder = existingRemoteFolder
          ? await transports.updateAssetFolder({ ...upsertFolder, parent_id: remoteParentId !== null ? remoteParentId : undefined })
          : await transports.createAssetFolder(upsertFolder);

        // If folder is already mapped it must also be in the manifest already.
        if (!maps.assetFolders.get(folder.id)) {
          await transports.appendAssetFolderManifest(folder, newRemoteFolder);
        }

        await transports.cleanupAssetFolder?.({ localFilePath: context.localFilePath });

        onFolderSuccess?.(folder, newRemoteFolder);
      }
      catch (maybeError) {
        onFolderError?.(toError(maybeError), folder);
      }
      finally {
        onIncrement?.();
        callback();
      }
    },
  });
};

export interface LocalAssetPayload {
  asset: Asset | AssetCreate | AssetUpload;
  context: {
    fileBuffer: ArrayBuffer;
    assetBinaryPath: string;
    metadataFilePath?: string;
  };
}

export const readLocalAssetsStream = ({
  directoryPath,
  setTotalAssets,
  onAssetError,
}: {
  directoryPath: string;
  setTotalAssets?: (total: number) => void;
  onAssetError?: (error: Error) => void;
}) => {
  const iterator = async function* readAssets() {
    try {
      const files = await readdir(directoryPath);
      const metadataFiles = files.filter(file => file.endsWith('.json') && file !== 'manifest.jsonl');
      setTotalAssets?.(metadataFiles.length);
      for (const file of metadataFiles) {
        const filePath = join(directoryPath, file);
        try {
          const statResult = await stat(filePath);
          if (!statResult.isFile()) {
            continue;
          }
          const metadataContent = await readFile(filePath, 'utf8');
          const assetRaw = JSON.parse(metadataContent);
          const asset = {
            ...assetRaw,
            short_filename: assetRaw.short_filename || basename(assetRaw.filename),
          } satisfies AssetUpload;
          const baseName = parse(file).name;
          const extFromMetadata = extname(asset.short_filename || asset.filename) || '';
          const assetBinaryPath = join(directoryPath, `${baseName}${extFromMetadata}`);
          const fileBuffer = await readFile(assetBinaryPath) as unknown as ArrayBuffer;
          yield {
            asset,
            context: {
              fileBuffer,
              assetBinaryPath,
              metadataFilePath: filePath,
            },
          } satisfies LocalAssetPayload;
        }
        catch (maybeError) {
          onAssetError?.(toError(maybeError));
        }
      }
    }
    catch (maybeError) {
      onAssetError?.(toError(maybeError));
    }
  };
  return Readable.from(iterator());
};

export const readSingleAssetStream = ({
  asset,
  assetSource,
  onAssetError,
}: {
  asset: AssetUpload;
  assetSource: string;
  onAssetError?: (error: Error) => void;
}) => {
  const iterator = async function* readSingleAsset() {
    try {
      if (!isRemoteSource(assetSource)) {
        const statResult = await stat(assetSource);
        if (!statResult.isFile()) {
          throw new Error('Asset path must point to a file.');
        }
      }
      const fileBuffer = (isRemoteSource(assetSource)
        ? await downloadFile(assetSource)
        : await readFile(assetSource)) as ArrayBuffer;

      let assetBinaryPath: string = assetSource;
      if (isRemoteSource(assetSource)) {
        const tempDir = join(tmpdir(), 'storyblok-assets');
        await mkdir(tempDir, { recursive: true });
        const shortName = asset.short_filename || basename(assetSource);
        assetBinaryPath = join(tempDir, `${randomUUID()}-${shortName}`);
        const tempBuffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
        await writeFile(assetBinaryPath, tempBuffer);
      }

      yield {
        asset,
        context: {
          fileBuffer,
          assetBinaryPath,
        },
      } satisfies LocalAssetPayload;
    }
    catch (maybeError) {
      onAssetError?.(toError(maybeError));
    }
  };
  return Readable.from(iterator());
};

export type CreateAssetTransport = (asset: AssetCreate, fileBuffer: ArrayBuffer) => Promise<Asset>;

export const makeCreateAssetAPITransport = ({ spaceId }: { spaceId: string }): CreateAssetTransport =>
  (asset, fileBuffer) => createAsset(asset, fileBuffer, { spaceId });

export type UpdateAssetTransport = (asset: AssetUpdate, fileBuffer: ArrayBuffer) => Promise<Asset>;

export const makeUpdateAssetAPITransport = ({
  spaceId,
}: {
  spaceId: string;
}): UpdateAssetTransport =>
  (asset, fileBuffer) => updateAsset(asset, fileBuffer, {
    spaceId,
  });

export type AppendAssetManifestTransport = (
  localAsset: { id: Asset['id']; filename?: string },
  remoteAsset: { id: Asset['id']; filename?: string },
) => Promise<void>;

export const makeAppendAssetManifestFSTransport = ({ manifestFile }: { manifestFile: string }): AppendAssetManifestTransport =>
  async (localAsset, remoteAsset) => {
    const createdAt = new Date().toISOString();
    await appendToFile(manifestFile, JSON.stringify({
      old_id: localAsset.id,
      new_id: remoteAsset.id,
      old_filename: localAsset.filename,
      new_filename: remoteAsset.filename,
      created_at: createdAt,
    }));
  };

export type AppendAssetFolderManifestTransport = (
  localFolder: { id: AssetFolder['id'] },
  remoteFolder: { id: AssetFolder['id'] },
) => Promise<void>;

export const makeAppendAssetFolderManifestFSTransport = ({ manifestFile }: { manifestFile: string }): AppendAssetFolderManifestTransport =>
  async (localFolder, remoteFolder) => {
    const createdAt = new Date().toISOString();
    await appendToFile(manifestFile, JSON.stringify({
      old_id: localFolder.id,
      new_id: remoteFolder.id,
      created_at: createdAt,
    }));
  };

export type GetAssetTransport = (assetId: number) => Promise<Asset | undefined>;

export const makeGetAssetAPITransport = ({ spaceId }: { spaceId: string }): GetAssetTransport =>
  async (assetId: number) => {
    const { data, response } = await mapiClient().assets.get({
      path: {
        space_id: spaceId,
        asset_id: assetId,
      },
    });

    if (!response.ok && response.status !== 404) {
      handleAPIError('pull_asset', new FetchError(response.statusText, response));
    }

    // @ts-expect-error Our types are wrong
    if (data?.deleted_at) {
      return undefined;
    }

    return data as Asset;
  };

export type CleanupAssetTransport = (context: { assetBinaryPath: string; metadataFilePath?: string }) => Promise<void>;

export const makeCleanupAssetFSTransport = (): CleanupAssetTransport =>
  async ({ assetBinaryPath, metadataFilePath }) => {
    await unlink(assetBinaryPath);
    if (metadataFilePath) {
      await unlink(metadataFilePath);
    }
  };

const hasId = (a: unknown): a is { id: number } => {
  return !!a && typeof a === 'object' && 'id' in a && typeof (a as any).id === 'number';
};
const hasShortFilename = (a: unknown): a is { short_filename: string } => {
  return !!a && typeof a === 'object' && 'short_filename' in a && typeof (a as any).short_filename === 'string';
};

/**
 * Compares data (metadata and folder id) between local and remote assets.
 * Returns true if the data is identical (no update needed).
 */
const isDataUnchanged = (localAsset: AssetUpdate, remoteAsset: Asset): boolean => {
  if (localAsset.asset_folder_id !== remoteAsset.asset_folder_id) {
    return false;
  }

  if (
    localAsset.alt !== remoteAsset.alt
    || localAsset.title !== remoteAsset.title
    || localAsset.copyright !== remoteAsset.copyright
    || localAsset.source !== remoteAsset.source
    || localAsset.is_private !== remoteAsset.is_private
  ) {
    return false;
  }

  const localAssetMetadataEntries = Object.entries(localAsset.meta_data || {});
  const remoteAssetMetadataEntries = Object.entries(remoteAsset.meta_data || {});
  if (localAssetMetadataEntries.length !== remoteAssetMetadataEntries.length) {
    return false;
  }

  const hasChanges = localAssetMetadataEntries.some(([k, v]) =>
    remoteAsset.meta_data && remoteAsset.meta_data[k] !== v);

  return !hasChanges;
};

/**
 * Checks if an asset update should be skipped because both file and metadata are unchanged.
 */
const isAssetUnchanged = async (
  localAsset: AssetUpdate,
  remoteAsset: Asset,
  localFileBuffer: ArrayBuffer,
  downloadAssetFileTransport: DownloadAssetFileTransport,
): Promise<boolean> => {
  const remoteFileBuffer = await downloadAssetFileTransport(remoteAsset);
  const isFileUnchanged = sha256(localFileBuffer) === sha256(remoteFileBuffer);
  if (!isFileUnchanged) {
    return false;
  }

  return isDataUnchanged(localAsset, remoteAsset);
};

export type DownloadAssetFileTransport = (asset: { filename: string; is_private?: boolean }) => Promise<ArrayBuffer>;

export const makeDownloadAssetFileTransport = ({
  assetToken,
  region,
}: {
  assetToken?: string;
  region?: RegionCode;
}): DownloadAssetFileTransport => asset => downloadAssetFile(asset, { assetToken, region });

const processAsset = async ({
  localAsset,
  fileBuffer,
  assetBinaryPath,
  metadataFilePath,
  transports,
  maps,
}: {
  localAsset: Asset | AssetCreate | AssetUpload;
  fileBuffer: ArrayBuffer;
  assetBinaryPath: string;
  metadataFilePath?: string;
  transports: {
    getAsset: GetAssetTransport;
    createAsset: CreateAssetTransport;
    updateAsset: UpdateAssetTransport;
    downloadAssetFile: DownloadAssetFileTransport;
    appendAssetManifest: AppendAssetManifestTransport;
    cleanupAsset?: CleanupAssetTransport;
  };
  maps: { assets: AssetMap; assetFolders: AssetFolderMap };
}): Promise<{ status: 'skipped' | 'created' | 'updated'; remoteAsset: Asset }> => {
  const remoteFolderId = localAsset.asset_folder_id
    && (maps.assetFolders.get(localAsset.asset_folder_id) || localAsset.asset_folder_id);
  const remoteAssetId = hasId(localAsset)
    ? maps.assets.get(localAsset.id)?.new.id || localAsset.id
    : undefined;
  const remoteAsset = remoteAssetId ? await transports.getAsset(remoteAssetId) : null;

  let newRemoteAsset: Asset;
  let status: 'skipped' | 'created' | 'updated';
  if (remoteAsset) {
    const updatePayload = {
      ...remoteAsset,
      ...localAsset,
      id: remoteAsset.id,
      asset_folder_id: remoteFolderId,
    } satisfies AssetUpdate;
    const canSkip = await isAssetUnchanged(
      updatePayload,
      remoteAsset,
      fileBuffer,
      transports.downloadAssetFile,
    );

    if (canSkip) {
      newRemoteAsset = remoteAsset;
      status = 'skipped';
    }
    else {
      newRemoteAsset = await transports.updateAsset(updatePayload, fileBuffer);
      status = 'updated';
    }
  }
  else if (hasShortFilename(localAsset)) {
    const createPayload = {
      ...localAsset,
      asset_folder_id: remoteFolderId,
    } satisfies AssetCreate;
    newRemoteAsset = await transports.createAsset(createPayload, fileBuffer);
    status = 'created';
  }
  else {
    throw new Error('Could neither create nor update the asset: Missing ID and Filename');
  }

  if (hasId(localAsset)) {
    await transports.appendAssetManifest(localAsset, newRemoteAsset);
  }
  await transports.cleanupAsset?.({ assetBinaryPath, metadataFilePath });

  return { status, remoteAsset: newRemoteAsset };
};

export const upsertAssetStream = ({
  transports,
  maps,
  onIncrement,
  onAssetSuccess,
  onAssetSkipped,
  onAssetError,
}: {
  transports: {
    getAsset: GetAssetTransport;
    createAsset: CreateAssetTransport;
    updateAsset: UpdateAssetTransport;
    downloadAssetFile: DownloadAssetFileTransport;
    appendAssetManifest: AppendAssetManifestTransport;
    cleanupAsset?: CleanupAssetTransport;
  };
  maps: { assets: AssetMap; assetFolders: AssetFolderMap };
  onIncrement?: () => void;
  onAssetSuccess?: (localAsset: Asset | AssetCreate | AssetUpload, remoteAsset: Asset) => void;
  onAssetSkipped?: (localAsset: Asset | AssetCreate | AssetUpload, remoteAsset: Asset) => void;
  onAssetError?: (error: Error, asset: Asset | AssetUpload) => void;
}) => {
  const processing = new Set<Promise<void>>();

  return new Writable({
    objectMode: true,
    async write({ asset: localAsset, context }: LocalAssetPayload, _encoding, callback) {
      await apiConcurrencyLock.acquire();
      const task = (async () => {
        try {
          const { status, remoteAsset } = await processAsset({
            localAsset,
            fileBuffer: context.fileBuffer,
            assetBinaryPath: context.assetBinaryPath,
            metadataFilePath: context.metadataFilePath,
            transports,
            maps,
          });

          if (status === 'skipped') {
            onAssetSkipped?.(localAsset, remoteAsset);
          }
          else {
            onAssetSuccess?.(localAsset, remoteAsset);
          }
        }
        catch (maybeError) {
          onAssetError?.(toError(maybeError), localAsset);
        }
      })();

      processing.add(task);
      task.finally(() => {
        onIncrement?.();
        apiConcurrencyLock.release();
        processing.delete(task);
      });

      callback();
    },
    final(callback) {
      Promise.all(processing).finally(() => callback());
    },
  });
};
