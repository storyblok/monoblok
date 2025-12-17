import { Buffer } from 'node:buffer';
import { basename, extname, join, parse } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { Sema } from 'async-sema';
import { readdir, readFile, stat } from 'node:fs/promises';
import { appendToFile, sanitizeFilename, saveToFile } from '../../utils/filesystem';
import { toError } from '../../utils/error/error';
import type { RegionCode } from '../../constants';
import type { Asset, AssetFolder, AssetsQueryParams, FetchAssetsResult, SignedAssetUpload } from './actions';
import { createAssetFolder, fetchAssetFile, fetchAssetFolders, fetchAssets, finishAssetUpload, requestAssetUpload, uploadAssetToS3 } from './actions';

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

export interface RequestAssetUploadTransport {
  create: (asset: Asset, assetFolderId?: number | null) => Promise<SignedAssetUpload>;
}

export interface UploadAssetTransport {
  upload: (payload: { signed: SignedAssetUpload; asset: Asset; fileBuffer: ArrayBuffer }) => Promise<void>;
}

export interface FinishAssetUploadTransport {
  finish: (payload: { assetId: number | string }) => Promise<Asset>;
}

export interface AppendAssetManifestTransport {
  append: (localAsset: Asset, remoteAsset: Asset) => Promise<void>;
}

export const makeRequestAssetUploadTransport = ({ spaceId, maps }: {
  spaceId: string;
  maps: { assetFolders: Map<number, number> };
}): RequestAssetUploadTransport => ({
  create: async (asset, assetFolderId) => {
    const targetFolderId = assetFolderId ?? (asset.asset_folder_id ? maps.assetFolders.get(asset.asset_folder_id) ?? asset.asset_folder_id : undefined);
    const signed = await requestAssetUpload(spaceId, {
      asset: {
        filename: asset.name || basename(asset.filename),
        asset_folder_id: targetFolderId ?? undefined,
        // TODO NOW remove because it's optional
        size: (asset.filename.match(/\/(\d+x\d+)\//) || [])[1],
        validate_upload: 1,
      },
    });
    if (!signed) {
      throw new Error('Failed to request asset upload');
    }
    return signed;
  },
});

export const makeUploadAssetTransport = (): UploadAssetTransport => ({
  upload: async ({ signed, asset, fileBuffer }) => {
    const response = await uploadAssetToS3({
      signedUpload: signed,
      fileBuffer,
      filename: asset.name || basename(asset.filename),
    });
    if (!response || !response.ok) {
      throw new Error('Failed to upload asset to storage');
    }
  },
});

export const makeFinishAssetUploadTransport = ({ spaceId }: {
  spaceId: string;
}): FinishAssetUploadTransport => ({
  finish: async ({ assetId }) => {
    const asset = await finishAssetUpload({
      spaceId,
      assetId,
    });
    if (!asset) {
      throw new Error('Failed to finish asset upload');
    }
    return asset;
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
  requestTransport,
  uploadTransport,
  finishTransport,
  manifestTransport,
  maps,
  onIncrement,
  onAssetSuccess,
  onAssetError,
}: {
  requestTransport: RequestAssetUploadTransport;
  uploadTransport: UploadAssetTransport;
  finishTransport: FinishAssetUploadTransport;
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
        const signed = await requestTransport.create(payload.asset);
        await uploadTransport.upload({ signed, asset: payload.asset, fileBuffer: payload.fileBuffer });
        const remoteAsset = await finishTransport.finish({ assetId: signed.id });
        await manifestTransport.append(payload.asset, remoteAsset);
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
