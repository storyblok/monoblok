import { Buffer } from 'node:buffer';
import { basename, extname, join, parse } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import { readdir, readFile, stat } from 'node:fs/promises';
import { appendToFile, sanitizeFilename, saveToFile } from '../../utils/filesystem';
import { toError } from '../../utils/error/error';
import type { RegionCode } from '../../constants';
import type { Asset, AssetFolder, AssetsQueryParams, FetchAssetsResult } from './actions';
import { createAsset, createAssetFolder, fetchAssetFile, fetchAssetFolders, fetchAssets, updateAsset } from './actions';

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
  onPageSuccess?: (page: number, total: number, assets: FetchAssetsResult['assets']) => void;
  onPageError?: (error: Error, page: number, total: number) => void;
}) => {
  const listGenerator = async function* assetListIterator() {
    let perPage = 100;
    let page = 1;
    let totalPages = 1;
    setTotalPages?.(totalPages);

    while (page <= totalPages) {
      try {
        const result = await fetchAssets(spaceId, {
          ...params,
          per_page: perPage,
          page,
        });
        if (!result) {
          break;
        }

        const { headers, assets } = result;
        const total = Number(headers.get('Total'));
        perPage = Number(headers.get('Per-Page')) || perPage;
        totalPages = Math.max(1, Math.ceil(total / perPage));
        setTotalAssets?.(total);
        setTotalPages?.(totalPages);
        onPageSuccess?.(page, totalPages, assets);

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

      const task = fetchAssetFile(asset)
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
  token,
  region,
  setTotalFolders,
  onSuccess,
  onError,
}: {
  spaceId: string;
  token: string;
  region?: RegionCode;
  setTotalFolders?: (total: number) => void;
  onSuccess?: (folders: AssetFolder[]) => void;
  onError?: (error: Error) => void;
}) => {
  const listGenerator = async function* folderListIterator() {
    try {
      const result = await fetchAssetFolders(spaceId, token, region);
      if (!result) {
        return;
      }
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
      const folderDir = join(directoryPath, 'folders');
      const files = await readdir(folderDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      setTotalFolders?.(jsonFiles.length);
      for (const file of jsonFiles) {
        try {
          const content = await readFile(join(folderDir, file), 'utf8');
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
  create: (folder: AssetFolder) => Promise<AssetFolder>;
}

export const makeCreateAssetFolderAPITransport = ({ spaceId, token, region, maps }: {
  spaceId: string;
  token: string;
  region?: RegionCode;
  maps: { assetFolders: Map<number, number> };
}): CreateAssetFolderTransport => ({
  create: async (folder) => {
    const parentId = folder.parent_id ? maps.assetFolders.get(folder.parent_id) ?? null : null;
    const remoteFolder = await createAssetFolder({
      spaceId,
      token,
      region,
      folder: {
        name: folder.name,
        parent_id: parentId,
      },
    });
    if (!remoteFolder) {
      throw new Error('Failed to create asset folder');
    }
    maps.assetFolders.set(folder.id, remoteFolder.id);
    return remoteFolder;
  },
});

export const createAssetFolderStream = ({
  transport,
  manifestTransport,
  onIncrement,
  onFolderSuccess,
  onFolderError,
}: {
  transport: CreateAssetFolderTransport;
  manifestTransport?: AppendAssetFolderManifestTransport;
  onIncrement?: () => void;
  onFolderSuccess?: (localFolder: AssetFolder, remoteFolder: AssetFolder) => void;
  onFolderError?: (error: Error, folder: AssetFolder) => void;
}) => {
  return new Writable({
    objectMode: true,
    async write(folder: AssetFolder, _encoding, callback) {
      try {
        const remoteFolder = await transport.create(folder);
        if (manifestTransport) {
          await manifestTransport.append(folder, remoteFolder);
        }
        onFolderSuccess?.(folder, remoteFolder);
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
  asset: Asset;
  fileBuffer: ArrayBuffer;
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
          const asset = JSON.parse(metadataContent) as Asset;
          const baseName = parse(file).name;
          const extFromMetadata = extname(asset.filename) || '';
          const assetFilePath = extFromMetadata
            ? join(directoryPath, `${baseName}${extFromMetadata}`)
            : join(directoryPath, `${baseName}`);
          const fileBuffer = await readFile(assetFilePath);
          yield { asset, fileBuffer };
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

export interface AppendAssetManifestTransport {
  append: (localAsset: Asset, remoteAsset: Asset) => Promise<void>;
}

export interface CreateAssetTransport {
  create: (payload: {
    asset: Asset;
    fileBuffer: ArrayBuffer;
  }) => Promise<Asset>;
}

export interface UpdateAssetTransport {
  update: (payload: {
    assetId: number | string;
    assetFolderId?: number | null;
  }) => Promise<Asset>;
}

export const makeCreateAssetAPITransport = ({ spaceId }: { spaceId: string }): CreateAssetTransport => ({
  create: async ({ asset, fileBuffer }) => {
    const remoteAsset = await createAsset(spaceId, { asset, fileBuffer });
    if (!remoteAsset) {
      throw new Error('Failed to create asset');
    }
    return remoteAsset;
  },
});

export const makeUpdateAssetAPITransport = ({ spaceId }: { spaceId: string }): UpdateAssetTransport => ({
  update: async ({ assetId, assetFolderId }) => {
    const updatedAsset = await updateAsset(spaceId, { assetId, asset: { asset_folder_id: assetFolderId ?? undefined } });
    if (!updatedAsset) {
      throw new Error('Failed to update asset');
    }
    return updatedAsset;
  },
});

export const makeAppendAssetManifestFSTransport = ({ manifestFile }: { manifestFile: string }): AppendAssetManifestTransport => ({
  append: async (localAsset, remoteAsset) => {
    const createdAt = new Date().toISOString();
    await appendToFile(manifestFile, JSON.stringify({
      old_id: localAsset.id,
      new_id: remoteAsset.id,
      created_at: createdAt,
    }));
  },
});

export interface AppendAssetFolderManifestTransport {
  append: (localFolder: AssetFolder, remoteFolder: AssetFolder) => Promise<void>;
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

export const uploadAssetStream = ({
  createTransport,
  updateTransport,
  manifestTransport,
  maps,
  onIncrement,
  onAssetSuccess,
  onAssetError,
}: {
  createTransport: CreateAssetTransport;
  updateTransport: UpdateAssetTransport;
  manifestTransport: AppendAssetManifestTransport;
  maps: { assets: Map<number, number>; assetFolders: Map<number, number> };
  onIncrement?: () => void;
  onAssetSuccess?: (localAsset: Asset, remoteAsset: Asset) => void;
  onAssetError?: (error: Error, asset: Asset) => void;
}) => {
  return new Writable({
    objectMode: true,
    async write(payload: LocalAssetPayload, _encoding, callback) {
      try {
        const mappedFolderId = payload.asset.asset_folder_id
          && (maps.assetFolders.get(payload.asset.asset_folder_id) || payload.asset.asset_folder_id);
        const existingRemoteId = maps.assets.get(payload.asset.id);

        const remoteAsset = existingRemoteId
          ? await updateTransport.update({ assetId: existingRemoteId, assetFolderId: mappedFolderId })
          : await createTransport.create({
            asset: { ...payload.asset, asset_folder_id: mappedFolderId },
            fileBuffer: payload.fileBuffer,
          });

        if (!existingRemoteId) {
          await manifestTransport.append(payload.asset, remoteAsset);
        }

        maps.assets.set(payload.asset.id, remoteAsset.id);
        onAssetSuccess?.(payload.asset, remoteAsset);
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
