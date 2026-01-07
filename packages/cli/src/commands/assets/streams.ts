import { Buffer } from 'node:buffer';
import { basename, extname, join, parse } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { appendToFile, sanitizeFilename, saveToFile } from '../../utils/filesystem';
import { toError } from '../../utils/error/error';
import { createAsset, createAssetFolder, fetchAssetFile, fetchAssetFolders, fetchAssets, updateAsset, updateAssetFolder } from './actions';
import type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetsQueryParams, AssetUpdate, AssetUpload } from './types';
import { mapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';
import { FetchError } from '../../utils/fetch';
import { isRemoteSource } from './utils';

const getAssetNameAndExt = (asset: Asset) => {
  const nameWithExt = asset.short_filename || basename(asset.filename);
  const ext = extname(nameWithExt);
  const name = sanitizeFilename(nameWithExt.replace(ext, '') || String(asset.id));
  return { name, ext };
};

const getFolderFilename = (folder: AssetFolder) => {
  const sanitizedName = sanitizeFilename(folder.name || '');
  const baseName = sanitizedName || folder.uuid;
  return `${baseName}_${folder.uuid}.json`;
};

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
  batchSize = 12,
  onIncrement,
  onAssetSuccess,
  onAssetError,
}: {
  batchSize?: number;
  onIncrement?: () => void;
  onAssetSuccess?: (asset: Asset) => void;
  onAssetError?: (error: Error, asset: Asset) => void;
}) => {
  const readLock = new Sema(batchSize);
  const processing = new Set<Promise<void>>();

  return new Transform({
    objectMode: true,
    async transform(asset: Asset, _encoding, callback) {
      await readLock.acquire();

      const task = fetchAssetFile(asset.filename)
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
          readLock.release();
          processing.delete(task);
        });
      processing.add(task);

      callback();
    },
    flush(callback) {
      Promise.all(processing).finally(() => callback());
    },
  });
};

export interface WriteAssetTransport {
  write: (asset: Asset, fileBuffer: ArrayBuffer) => Promise<Asset>;
}

export const makeWriteAssetFSTransport = ({ directoryPath }: {
  directoryPath: string;
}): WriteAssetTransport => ({
  write: async (asset, fileBuffer) => {
    const { name, ext } = getAssetNameAndExt(asset);
    const assetFilePath = join(directoryPath, `${name}_${asset.id}${ext}`);
    const metadataFilePath = join(directoryPath, `${name}_${asset.id}.json`);
    await saveToFile(assetFilePath, Buffer.from(fileBuffer));
    await saveToFile(metadataFilePath, JSON.stringify(asset, null, 2));
    return asset;
  },
});

export const writeAssetStream = ({
  transport,
  onIncrement,
  onAssetSuccess,
  onAssetError,
}: {
  transport: WriteAssetTransport;
  onIncrement?: () => void;
  onAssetSuccess?: (asset: Asset) => void;
  onAssetError?: (error: Error, asset: Asset) => void;
}) => {
  return new Writable({
    objectMode: true,
    async write(payload: { asset: Asset; fileBuffer: ArrayBuffer }, _encoding, callback) {
      try {
        await transport.write(payload.asset, payload.fileBuffer);
        onAssetSuccess?.(payload.asset);
      }
      catch (maybeError) {
        onAssetError?.(toError(maybeError), payload.asset);
      }
      finally {
        onIncrement?.();
        callback();
      }
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

export interface WriteAssetFolderTransport {
  write: (folder: AssetFolder) => Promise<AssetFolder>;
}

export const makeWriteAssetFolderFSTransport = ({ directoryPath }: {
  directoryPath: string;
}): WriteAssetFolderTransport => ({
  write: async (folder) => {
    const filename = getFolderFilename(folder);
    await saveToFile(join(directoryPath, 'folders', filename), JSON.stringify(folder, null, 2));
    return folder;
  },
});

export const writeAssetFolderStream = ({
  transport,
  onIncrement,
  onFolderSuccess,
  onFolderError,
}: {
  transport: WriteAssetFolderTransport;
  onIncrement?: () => void;
  onFolderSuccess?: (folder: AssetFolder) => void;
  onFolderError?: (error: Error, folder: AssetFolder) => void;
}) => {
  return new Writable({
    objectMode: true,
    async write(folder: AssetFolder, _encoding, callback) {
      try {
        await transport.write(folder);
        onFolderSuccess?.(folder);
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

export interface ReadLocalAssetFolderOptions {
  directoryPath: string;
  setTotalFolders?: (total: number) => void;
  onFolderError?: (error: Error) => void;
}

export const readLocalAssetFoldersStream = ({
  directoryPath,
  setTotalFolders,
  onFolderError,
}: ReadLocalAssetFolderOptions) => {
  const iterator = async function* readFolders() {
    try {
      const files = await readdir(directoryPath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      setTotalFolders?.(jsonFiles.length);
      for (const file of jsonFiles) {
        try {
          const content = await readFile(join(directoryPath, file), 'utf8');
          const folder = JSON.parse(content) as AssetFolder;
          yield folder;
        }
        catch (maybeError) {
          onFolderError?.(toError(maybeError));
        }
      }
    }
    catch (maybeError) {
      onFolderError?.(toError(maybeError));
    }
  };
  return Readable.from(iterator());
};

export interface CreateAssetFolderTransport {
  create: (folder: AssetFolderCreate) => Promise<AssetFolder>;
}

export const makeCreateAssetFolderAPITransport = ({ spaceId }: {
  spaceId: string;
}): CreateAssetFolderTransport => ({
  create: folder => createAssetFolder({
    name: folder.name,
    parent_id: folder.parent_id ?? undefined,
  }, {
    spaceId,
  }),
});

export interface UpdateAssetFolderTransport {
  update: (folder: AssetFolderUpdate) => Promise<AssetFolderUpdate>;
}

export const makeUpdateAssetFolderAPITransport = ({ spaceId }: {
  spaceId: string;
}): UpdateAssetFolderTransport => ({
  update: folder => updateAssetFolder(folder, { spaceId }),
});

export interface GetAssetFolderTransport {
  get: (folderId: number) => Promise<AssetFolder | undefined>;
}

export const makeGetAssetFolderAPITransport = ({ spaceId }: {
  spaceId: string;
}): GetAssetFolderTransport => ({
  get: async (folderId) => {
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
  },
});

export const upsertAssetFolderStream = ({
  getTransport,
  createTransport,
  updateTransport,
  manifestTransport,
  maps,
  onIncrement,
  onFolderSuccess,
  onFolderError,
}: {
  getTransport: GetAssetFolderTransport;
  createTransport: CreateAssetFolderTransport;
  updateTransport: UpdateAssetFolderTransport;
  manifestTransport: AppendAssetFolderManifestTransport;
  maps: { assetFolders: Map<number, number> };
  onIncrement?: () => void;
  onFolderSuccess?: (localFolder: AssetFolder, remoteFolder: AssetFolder | AssetFolderUpdate) => void;
  onFolderError?: (error: Error, folder: AssetFolder) => void;
}) => {
  return new Writable({
    objectMode: true,
    async write(folder: AssetFolder, _encoding, callback) {
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
        const existingRemoteFolder = await getTransport.get(remoteFolderId);
        const newRemoteFolder = existingRemoteFolder
          ? await updateTransport.update({ ...upsertFolder, parent_id: remoteParentId !== null ? remoteParentId : undefined })
          : await createTransport.create(upsertFolder);

        // If folder is already mapped it must also be in the manifest already.
        if (!maps.assetFolders.get(folder.id)) {
          await manifestTransport.append(folder, newRemoteFolder);
        }

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
    assetFilePath: string;
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
          const assetFilePath = join(directoryPath, `${baseName}${extFromMetadata}`);
          const fileBuffer = await readFile(assetFilePath) as unknown as ArrayBuffer;
          yield {
            asset,
            context: {
              fileBuffer,
              assetFilePath,
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
        ? await fetchAssetFile(assetSource)
        : await readFile(assetSource)) as ArrayBuffer;

      let assetFilePath: string = assetSource;
      if (isRemoteSource(assetSource)) {
        const tempDir = join(tmpdir(), 'storyblok-assets');
        await mkdir(tempDir, { recursive: true });
        const shortName = asset.short_filename || basename(assetSource);
        assetFilePath = join(tempDir, `${randomUUID()}-${shortName}`);
        const tempBuffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
        await writeFile(assetFilePath, tempBuffer);
      }

      yield {
        asset,
        context: {
          fileBuffer,
          assetFilePath,
        },
      } satisfies LocalAssetPayload;
    }
    catch (maybeError) {
      onAssetError?.(toError(maybeError));
    }
  };
  return Readable.from(iterator());
};

export interface CreateAssetTransport {
  create: (asset: AssetCreate, fileBuffer: ArrayBuffer) => Promise<Asset>;
}

export const makeCreateAssetAPITransport = ({ spaceId }: { spaceId: string }): CreateAssetTransport => ({
  create: (asset, fileBuffer) => createAsset(asset, fileBuffer, { spaceId }),
});

export interface UpdateAssetTransport {
  update: (asset: AssetUpdate, fileBuffer: ArrayBuffer) => Promise<Asset>;
}

export const makeUpdateAssetAPITransport = ({ spaceId }: { spaceId: string }): UpdateAssetTransport => ({
  update: (asset, fileBuffer) => updateAsset(asset, fileBuffer, { spaceId }),
});

export interface AppendAssetManifestTransport {
  append: (localAsset: { id: Asset['id']; filename?: string }, remoteAsset: { id: Asset['id']; filename?: string }) => Promise<void>;
}

export const makeAppendAssetManifestFSTransport = ({ manifestFile }: { manifestFile: string }): AppendAssetManifestTransport => ({
  append: async (localAsset, remoteAsset) => {
    const createdAt = new Date().toISOString();
    await appendToFile(manifestFile, JSON.stringify({
      old_id: localAsset.id,
      new_id: remoteAsset.id,
      old_filename: localAsset.filename,
      new_filename: remoteAsset.filename,
      created_at: createdAt,
    }));
  },
});

export interface AppendAssetFolderManifestTransport {
  append: (localFolder: { id: AssetFolder['id'] }, remoteFolder: { id: AssetFolder['id'] }) => Promise<void>;
}

export const makeAppendAssetFolderManifestFSTransport = ({ manifestFile }: { manifestFile: string }): AppendAssetFolderManifestTransport => ({
  append: async (localFolder, remoteFolder) => {
    const createdAt = new Date().toISOString();
    await appendToFile(manifestFile, JSON.stringify({
      old_id: localFolder.id,
      new_id: remoteFolder.id,
      created_at: createdAt,
    }));
  },
});

export interface GetAssetTransport {
  get: (assetId: number) => Promise<Asset | undefined>;
}

export const makeGetAssetAPITransport = ({ spaceId }: { spaceId: string }): GetAssetTransport => ({
  get: async (assetId: number) => {
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
  },
});

const cleanupAssets = async ({ assetFilePath, metadataFilePath }: { assetFilePath: string; metadataFilePath?: string }) => {
  await unlink(assetFilePath);
  if (metadataFilePath) {
    await unlink(metadataFilePath);
  }
};

const hasId = (a: unknown): a is { id: number } => {
  return !!a && typeof a === 'object' && 'id' in a && typeof (a as any).id === 'number';
};
const hasFilename = (a: unknown): a is { filename: string } => {
  return !!a && typeof a === 'object' && 'filename' in a && typeof (a as any).filename === 'string';
};
const hasShortFilename = (a: unknown): a is { short_filename: string } => {
  return !!a && typeof a === 'object' && 'short_filename' in a && typeof (a as any).short_filename === 'string';
};

export const upsertAssetStream = ({
  getTransport,
  createTransport,
  updateTransport,
  manifestTransport,
  maps,
  cleanup,
  onIncrement,
  onAssetSuccess,
  onAssetError,
}: {
  getTransport: GetAssetTransport;
  createTransport: CreateAssetTransport;
  updateTransport: UpdateAssetTransport;
  manifestTransport: AppendAssetManifestTransport;
  maps: { assets: Map<number, number>; assetFolders: Map<number, number> };
  cleanup: boolean;
  onIncrement?: () => void;
  onAssetSuccess?: (localAsset: Asset | AssetUpload, remoteAsset: Asset) => void;
  onAssetError?: (error: Error, asset: Asset | AssetUpload) => void;
}) => {
  return new Writable({
    objectMode: true,
    async write({
      asset,
      context: { assetFilePath, metadataFilePath, fileBuffer },
    }: LocalAssetPayload, _encoding, callback) {
      try {
        const remoteFolderId = asset.asset_folder_id
          && (maps.assetFolders.get(asset.asset_folder_id) || asset.asset_folder_id);
        const remoteAssetId = hasId(asset) ? (maps.assets.get(asset.id) || asset.id) : undefined;
        const upsertAsset = {
          ...asset,
          id: remoteAssetId,
          asset_folder_id: remoteFolderId,
        };
        // If a remote asset already exists, we must not create a new asset.
        // This can happen when the user resumes a failed push or runs push multiple times.
        const canUpdate = hasId(upsertAsset)
          && hasFilename(upsertAsset)
          && Boolean(await getTransport.get(upsertAsset.id));
        const canCreate = hasShortFilename(upsertAsset);
        const newRemoteAsset = canUpdate
          ? await updateTransport.update(upsertAsset, fileBuffer)
          : canCreate
            ? await createTransport.create(upsertAsset, fileBuffer)
            : undefined;

        if (!newRemoteAsset) {
          throw new Error('Could neither create nor update the asset!');
        }

        if (hasId(asset)) {
          await manifestTransport.append(asset, newRemoteAsset);
        }

        if (cleanup) {
          await cleanupAssets({ assetFilePath, metadataFilePath });
        }

        onAssetSuccess?.(asset, newRemoteAsset);
      }
      catch (maybeError) {
        onAssetError?.(toError(maybeError), asset);
      }
      finally {
        onIncrement?.();
        callback();
      }
    },
  });
};
