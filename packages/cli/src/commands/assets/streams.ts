import { Buffer } from 'node:buffer';
import { basename, extname, join, parse } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import { readdir, readFile, stat } from 'node:fs/promises';
import { appendToFile, sanitizeFilename, saveToFile } from '../../utils/filesystem';
import { toError } from '../../utils/error/error';
import type { RegionCode } from '../../constants';
import { createAsset, createAssetFolder, fetchAssetFile, fetchAssetFolders, fetchAssets, updateAsset } from './actions';
import type { Asset, AssetFolder, AssetsQueryParams, AssetUpdate } from './types';
import { mapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';
import { FetchError } from '../../utils/fetch';

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
        if (!result) {
          break;
        }

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
      const result = await fetchAssetFolders({ spaceId, token, region });
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
    const parentId = folder.parent_id ? (maps.assetFolders.get(folder.parent_id) || folder.parent_id) : undefined;
    const remoteFolder = await createAssetFolder({
      name: folder.name,
      parent_id: parentId,
    }, {
      spaceId,
      token,
      region,
    });
    if (!remoteFolder) {
      throw new Error('Failed to create asset folder');
    }
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

export interface CreateAssetTransport {
  create: (asset: Asset, fileBuffer: ArrayBuffer) => Promise<Asset>;
}

export const makeCreateAssetAPITransport = ({ spaceId }: { spaceId: string }): CreateAssetTransport => ({
  create: async (asset, fileBuffer) => {
    const remoteAsset = await createAsset(asset, fileBuffer, { spaceId });
    if (!remoteAsset) {
      throw new Error('Failed to create asset');
    }
    return remoteAsset;
  },
});

export interface UpdateAssetTransport {
  update: (asset: AssetUpdate, fileBuffer: ArrayBuffer) => Promise<Asset>;
}

export const makeUpdateAssetAPITransport = ({ spaceId }: { spaceId: string }): UpdateAssetTransport => ({
  update: async (asset, fileBuffer) => {
    const updatedAsset = await updateAsset(asset, fileBuffer, { spaceId });
    if (!updatedAsset) {
      throw new Error('Failed to update asset');
    }
    return updatedAsset;
  },
});

export interface AppendAssetManifestTransport {
  append: (localAsset: Asset, remoteAsset: Asset) => Promise<void>;
}

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

const getRemoteAsset = async (assetId: number, { spaceId }: {
  spaceId: string;
}) => {
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

export const upsertAssetStream = ({
  createTransport,
  updateTransport,
  manifestTransport,
  maps,
  spaceId,
  onIncrement,
  onAssetSuccess,
  onAssetError,
}: {
  createTransport: CreateAssetTransport;
  updateTransport: UpdateAssetTransport;
  manifestTransport: AppendAssetManifestTransport;
  maps: { assets: Map<number, number>; assetFolders: Map<number, number> };
  spaceId: string;
  onIncrement?: () => void;
  onAssetSuccess?: (localAsset: Asset, remoteAsset: Asset) => void;
  onAssetError?: (error: Error, asset: Asset) => void;
}) => {
  return new Writable({
    objectMode: true,
    // TODO naming
    async write({ asset, fileBuffer }: LocalAssetPayload, _encoding, callback) {
      try {
        // TODO also only create folders that do not exist yet!
        const mappedFolderId = asset.asset_folder_id
          && (maps.assetFolders.get(asset.asset_folder_id) || asset.asset_folder_id);
        const mappedAssetId = maps.assets.get(asset.id) || asset.id;
        const mappedAsset = {
          ...asset,
          id: mappedAssetId,
          asset_folder_id: mappedFolderId,
        };
        // If a remote asset already exists, we must not create a new asset.
        // This can happen when the user resumes a failed push or runs push multiple times.
        let remoteAsset = await getRemoteAsset(mappedAsset.id, { spaceId });
        if (remoteAsset) {
          remoteAsset = await updateTransport.update(mappedAsset, fileBuffer);
        }
        else {
          remoteAsset = await createTransport.create(mappedAsset, fileBuffer);
        }

        // If asset is already mapped it must also be in the manifest already.
        if (!maps.assets.get(asset.id)) {
          await manifestTransport.append(asset, remoteAsset);
        }

        onAssetSuccess?.(asset, remoteAsset);
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
