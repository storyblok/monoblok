import Storyblok from 'storyblok-js-client';
import { getMapiClient } from '../../api';
import { createPipelineBackpressureLock } from '../../utils/backpressure-lock';
import { handleAPIError } from '../../utils/error/api-error';
import { getResponseStatus, toError } from '../../utils/error/error';
import { FetchError } from '../../utils/fetch';
import { fetchAllPages } from '../../utils/pagination';
import type { RegionCode } from '../../constants';
import type { Asset, AssetFolderCreate, AssetFolderUpdate, AssetInternalTagsByName, AssetListQuery, AssetUpdate, AssetUpload, SharedAssetFolderCreate, SharedAssetFolderUpdate, SharedInternalTagCreate } from './types';

/**
 * Fetches a single page of assets from Storyblok Management API.
 */
export const fetchAssets = async ({ spaceId, params }: {
  spaceId: string;
  params?: AssetListQuery;
}) => {
  try {
    const client = getMapiClient();
    const { data, response } = await client.assets.list({
      path: {
        space_id: Number(spaceId),
      },
      query: {
        ...params,
        per_page: params?.per_page || 100,
        page: params?.page || 1,
      },
      throwOnError: true,
    });
    const assets = (data?.assets || [])
      .filter((asset): asset is Asset => Boolean(asset?.id && asset?.filename));

    return {
      assets,
      headers: response.headers,
    };
  }
  catch (maybeError) {
    handleAPIError('pull_assets', toError(maybeError));
  }
};

/**
 * Fetches the IDs of every asset in a space (optionally filtered) by
 * paginating the Management API asset list. Used by `assets transfer --all`
 * to resolve the full working set before transferring. Mirrors the
 * pagination in `fetchAssetInternalTagsByName`.
 */
export const fetchAllSpaceAssetIds = async (spaceId: string, params?: AssetListQuery): Promise<number[]> => {
  try {
    const client = getMapiClient();
    const assets = await fetchAllPages(
      (page: number) => client.assets.list({
        path: { space_id: Number(spaceId) },
        query: { ...params, page, per_page: 100 },
        throwOnError: true,
      }),
      data => data?.assets ?? [],
    );
    return assets.reduce<number[]>((ids, asset) => {
      if (typeof asset?.id === 'number') {
        ids.push(asset.id);
      }
      return ids;
    }, []);
  }
  catch (maybeError) {
    handleAPIError('pull_assets', toError(maybeError));
  }
};

/**
 * Fetches the space's internal tags of type `asset` keyed by name.
 *
 * Used by `assets push` to translate source-space tag names carried in pulled
 * sidecars into the target space's tag IDs.
 */
export const fetchAssetInternalTagsByName = async (spaceId: string): Promise<AssetInternalTagsByName> => {
  try {
    const client = getMapiClient();
    const tags = await fetchAllPages(
      (page: number) => client.internalTags.list({
        path: { space_id: Number(spaceId) },
        query: { page, by_object_type: 'asset' },
        throwOnError: true,
      }),
      data => data?.internal_tags ?? [],
    );
    return new Map(
      tags
        .filter(tag => typeof tag?.id === 'number' && typeof tag?.name === 'string')
        .map(tag => [tag.name, tag.id] as const),
    );
  }
  catch (maybeError) {
    handleAPIError('pull_asset_internal_tags', toError(maybeError));
  }
};

/**
 * Creates an internal tag of type `asset` in the target space.
 *
 * Used by `assets push` to pre-create source-space tag names that do not yet
 * exist in the target space, so pushed assets keep their tags instead of having
 * the unknown references dropped.
 */
export const createAssetInternalTag = async (
  spaceId: string,
  name: string,
): Promise<{ id: number; name: string }> => {
  try {
    const client = getMapiClient();
    const { data } = await client.internalTags.create({
      path: { space_id: Number(spaceId) },
      body: { internal_tag: { name, object_type: 'asset' } },
      throwOnError: true,
    });
    const tag = data?.internal_tag;
    if (typeof tag?.id !== 'number' || typeof tag?.name !== 'string') {
      throw new TypeError('Created internal tag is missing an id or name');
    }
    return { id: tag.id, name: tag.name };
  }
  catch (maybeError) {
    handleAPIError('push_asset_internal_tag', toError(maybeError), `Failed to create internal asset tag "${name}"`);
  }
};

export const downloadFile = async (filename: string) => {
  const response = await fetch(filename);
  if (!response.ok) {
    throw new Error(`Failed to download ${filename}`);
  }
  return response.arrayBuffer();
};

/**
 * Fetches a signed URL for a private asset from the Content Delivery API.
 */
export const getSignedAssetUrl = async (
  filename: Asset['filename'],
  assetToken: string,
  region?: RegionCode,
): Promise<string> => {
  try {
    const client = new Storyblok({
      accessToken: assetToken,
      region: region || 'eu',
    });

    const response = await client.get('cdn/assets/me', {
      filename,
    });

    return response.data.asset.signed_url;
  }
  catch (maybeError) {
    handleAPIError('pull_asset', toError(maybeError));
  }
};

export const fetchAssetFolders = async ({ spaceId }: {
  spaceId: string;
}) => {
  try {
    const client = getMapiClient();
    const { data, response } = await client.assetFolders.list({
      path: {
        space_id: Number(spaceId),
      },
      throwOnError: true,
    });

    return {
      asset_folders: data.asset_folders || [],
      headers: response.headers,
    };
  }
  catch (maybeError) {
    handleAPIError('pull_asset_folders', toError(maybeError));
  }
};

export const createAssetFolder = async (folder: AssetFolderCreate, {
  spaceId,
}: {
  spaceId: string;
}) => {
  try {
    const client = getMapiClient();
    const { data } = await client.assetFolders.create({
      path: {
        space_id: Number(spaceId),
      },
      body: { asset_folder: folder },
      throwOnError: true,
    });
    const { asset_folder } = data;
    if (!asset_folder) {
      throw new Error('Failed to create asset folder');
    }

    return asset_folder;
  }
  catch (maybeError) {
    handleAPIError('push_asset_folder', toError(maybeError));
  }
};

export const updateAssetFolder = async (id: number, folder: AssetFolderUpdate, {
  spaceId,
}: {
  spaceId: string;
}) => {
  try {
    const client = getMapiClient();
    await client.assetFolders.update(id, {
      path: {
        space_id: Number(spaceId),
      },
      body: { asset_folder: folder },
      throwOnError: true,
    });

    return folder;
  }
  catch (maybeError) {
    handleAPIError('push_asset_folder', toError(maybeError));
  }
};

/** Downloads a remote asset file. Handles both public and private assets. */
export const downloadAssetFile = async (
  asset: { filename: string; is_private?: boolean },
  options: { assetToken?: string; region?: RegionCode },
): Promise<ArrayBuffer> => {
  let url = asset.filename;

  if (asset.is_private) {
    if (!options.assetToken) {
      throw new Error(`Asset ${asset.filename} is private but no asset token was provided. Use --asset-token to provide a token.`);
    }
    url = await getSignedAssetUrl(asset.filename, options.assetToken, options.region);
  }

  return downloadFile(url);
};

/**
 * Updates the metadata of an existing asset, and optionally replaces the file.
 *
 * When `fileBuffer` is provided, the mapi-client performs the full three-step
 * replace flow (sign → S3 upload → finalize) before updating metadata.
 * `short_filename` is required alongside `fileBuffer` for the sign request.
 *
 * When no `fileBuffer` is given, only the metadata PUT is issued.
 */
export const updateAsset = async (
  id: number,
  asset: AssetUpdate & { short_filename?: string },
  { spaceId, fileBuffer }: { spaceId: string; fileBuffer?: ArrayBuffer },
): Promise<void> => {
  try {
    const client = getMapiClient();
    const { short_filename, ...metadata } = asset;

    if (fileBuffer !== undefined) {
      if (!short_filename) {
        throw new Error('short_filename is required when replacing an asset file');
      }
      await client.assets.update(id, {
        path: { space_id: Number(spaceId) },
        body: { asset: metadata, short_filename },
        file: fileBuffer,
      });
    }
    else {
      await client.assets.update(id, {
        path: { space_id: Number(spaceId) },
        body: { asset: metadata },
      });
    }
  }
  catch (maybeError) {
    handleAPIError('push_asset_update', toError(maybeError));
  }
};

/**
 * Creates a new asset by performing the full three-step upload flow, then
 * applying metadata fields. Delegates entirely to the mapi-client's
 * `create()` convenience method.
 */
export const createAsset = async (
  asset: AssetUpload,
  fileBuffer: ArrayBuffer,
  { spaceId }: { spaceId: string },
): Promise<Asset> => {
  try {
    const client = getMapiClient();
    // `id`/`filename` are local-only identity fields (manifest mapping); drop
    // them so only upload fields reach the API. Read-only `Asset` fields are
    // already projected away upstream by `toAssetUpload`.
    const { id: _id, filename: _filename, ...assetBody } = asset;
    return await client.assets.create({
      body: assetBody,
      file: fileBuffer,
      path: { space_id: Number(spaceId) },
    });
  }
  catch (maybeError) {
    handleAPIError('push_asset_create', toError(maybeError));
  }
};

/**
 * Transfers a space-local asset into the org's shared library.
 *
 * UX wording is "transfer"; the backend endpoint is still `convert`
 * (`AssetsServices::ConvertToSharedAsset`). Drop this mapping when the backend
 * ships the `convert` -> `transfer` rename. One-way only (space to shared).
 *
 * A 403 comes from the backend authorization policy (`AssetPolicy#convert?`):
 * the target folder must exist in the shared asset library and the space must
 * have write access to it. Surface that as a friendly hint instead of a raw
 * API error.
 */
export const transferAsset = async (
  spaceId: string,
  assetId: number,
  folderId: number,
): Promise<Asset> => {
  try {
    const { data } = await getMapiClient().assets.convertToShared(assetId, {
      path: { space_id: Number(spaceId) },
      query: { target_asset_folder_id: folderId },
      throwOnError: true,
    });
    return data;
  }
  catch (maybeError) {
    const error = toError(maybeError);
    const status = getResponseStatus(maybeError);
    handleAPIError(
      'transfer_asset',
      error,
      status === 403
        ? `Not authorized to transfer into folder ${folderId}. Make sure it exists in the shared asset library and that this space has write access to it.`
        : undefined,
    );
  }
};

export interface TransferResult {
  assetId: number;
  status: 'transferred' | 'failed';
  filename?: string;
  reason?: string;
}

/**
 * Transfers multiple assets into the shared asset library, bounding in-flight
 * requests with the shared pipeline backpressure lock (2× the configured rate
 * limit), matching the throttle headroom used by the asset and story streams.
 * Per-asset errors are captured as failed results rather than aborting the
 * whole batch.
 */
export const transferAssets = async (
  spaceId: string,
  assetIds: number[],
  folderId: number,
  callbacks: {
    onSuccess?: (result: { assetId: number; filename?: string }) => void;
    onError?: (error: Error, assetId: number) => void;
  } = {},
): Promise<TransferResult[]> => {
  const lock = createPipelineBackpressureLock();

  return Promise.all(assetIds.map(async (assetId): Promise<TransferResult> => {
    await lock.acquire();
    try {
      const asset = await transferAsset(spaceId, assetId, folderId);
      callbacks.onSuccess?.({ assetId, filename: asset.filename });
      return { assetId, status: 'transferred', filename: asset.filename };
    }
    catch (maybeError) {
      const error = toError(maybeError);
      callbacks.onError?.(error, assetId);
      return { assetId, status: 'failed', reason: error.message };
    }
    finally {
      lock.release();
    }
  }));
};

/**
 * Fetches a page of shared (library) assets. `libraryId` is passed as the
 * `in_folder` filter so only assets in that library are returned.
 */
export const fetchSharedAssets = async ({ spaceId, libraryId, params }: {
  spaceId: string;
  libraryId: number;
  params?: AssetListQuery;
}) => {
  try {
    const client = getMapiClient();
    const { data, response } = await client.sharedAssets.list({
      path: { space_id: Number(spaceId) },
      query: { ...params, in_folder: libraryId, per_page: params?.per_page || 100, page: params?.page || 1 },
      throwOnError: true,
    });
    const assets = (data?.assets || [])
      .filter((asset): asset is Asset => Boolean(asset?.id && asset?.filename));

    return { assets, headers: response.headers };
  }
  catch (maybeError) {
    handleAPIError('pull_shared_assets', toError(maybeError));
  }
};

/**
 * Fetches the shared asset folders belonging to a library: the library root
 * and all of its descendants.
 */
export const fetchSharedAssetFolders = async ({ spaceId, libraryId }: {
  spaceId: string;
  libraryId: number;
}) => {
  try {
    const client = getMapiClient();
    const { data } = await client.sharedAssetFolders.list({
      path: { space_id: Number(spaceId) },
      throwOnError: true,
    });
    const all = data?.shared_asset_folders || [];
    // Index children by parent once, then walk down from the library root.
    const childrenByParent = new Map<number, typeof all>();
    for (const folder of all) {
      if (folder.parent_id == null) {
        continue;
      }
      const siblings = childrenByParent.get(folder.parent_id) ?? [];
      siblings.push(folder);
      childrenByParent.set(folder.parent_id, siblings);
    }
    const keep = new Set<number>([libraryId]);
    const queue = [libraryId];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      for (const child of childrenByParent.get(parentId) ?? []) {
        if (!keep.has(child.id)) {
          keep.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return { asset_folders: all.filter(folder => keep.has(folder.id)) };
  }
  catch (maybeError) {
    handleAPIError('pull_shared_asset_folders', toError(maybeError));
  }
};

export const createSharedAssetFolder = async (folder: SharedAssetFolderCreate, {
  spaceId,
}: {
  spaceId: string;
}) => {
  try {
    const client = getMapiClient();
    const { data } = await client.sharedAssetFolders.create({
      path: { space_id: Number(spaceId) },
      body: { shared_asset_folder: folder },
      throwOnError: true,
    });
    if (!data?.shared_asset_folder) {
      throw new Error('Failed to create shared asset folder');
    }
    return data.shared_asset_folder;
  }
  catch (maybeError) {
    handleAPIError('push_shared_asset_folder', toError(maybeError));
  }
};

export const updateSharedAssetFolder = async (id: number, folder: SharedAssetFolderUpdate, {
  spaceId,
}: {
  spaceId: string;
}) => {
  try {
    await getMapiClient().sharedAssetFolders.update(id, {
      path: { space_id: Number(spaceId) },
      body: { shared_asset_folder: folder },
      throwOnError: true,
    });
    return folder;
  }
  catch (maybeError) {
    handleAPIError('push_shared_asset_folder', toError(maybeError));
  }
};

// `getSharedAssetFolder`/`getSharedAsset` intentionally do NOT use the
// `throwOnError`/`handleAPIError` pattern of the surrounding actions: callers
// (upsert get-transports, referenced-asset resolution) treat a missing
// resource as a normal "not found" and rely on `undefined`. We therefore
// inspect `response.ok` by hand and only fail on non-404 errors.
export const getSharedAssetFolder = async (folderId: number, { spaceId }: { spaceId: string }) => {
  const { data, response } = await getMapiClient().sharedAssetFolders.get(folderId, {
    path: { space_id: Number(spaceId) },
  });
  if (!response.ok && response.status !== 404) {
    handleAPIError('pull_shared_asset_folder', new FetchError(response.statusText, response));
  }
  return data?.shared_asset_folder;
};

export const getSharedAsset = async (assetId: number, { spaceId }: { spaceId: string }) => {
  const { data, response } = await getMapiClient().sharedAssets.get(assetId, {
    path: { space_id: Number(spaceId) },
  });
  if (!response.ok && response.status !== 404) {
    handleAPIError('pull_shared_asset', new FetchError(response.statusText, response));
  }
  return data;
};

export const createSharedAsset = async (
  asset: AssetUpload,
  fileBuffer: ArrayBuffer,
  { spaceId }: { spaceId: string },
): Promise<Asset> => {
  try {
    const client = getMapiClient();
    // Strip `id` — it identifies the local/manifest asset for mapping and must
    // not flow into the metadata update inside the create flow.
    const { id: _id, ...assetBody } = asset;
    return await client.sharedAssets.create({
      body: assetBody,
      file: fileBuffer,
      path: { space_id: Number(spaceId) },
    });
  }
  catch (maybeError) {
    handleAPIError('push_shared_asset_create', toError(maybeError));
  }
};

export const updateSharedAsset = async (
  id: number,
  asset: AssetUpdate & { short_filename?: string },
  { spaceId, fileBuffer }: { spaceId: string; fileBuffer?: ArrayBuffer },
): Promise<void> => {
  try {
    const client = getMapiClient();
    const { short_filename, ...metadata } = asset;
    if (fileBuffer !== undefined) {
      if (!short_filename) {
        throw new Error('short_filename is required when replacing an asset file');
      }
      await client.sharedAssets.update(id, {
        path: { space_id: Number(spaceId) },
        body: { asset: metadata, short_filename },
        file: fileBuffer,
      });
    }
    else {
      await client.sharedAssets.update(id, {
        path: { space_id: Number(spaceId) },
        body: { asset: metadata },
      });
    }
  }
  catch (maybeError) {
    handleAPIError('push_shared_asset_update', toError(maybeError));
  }
};

export const fetchSharedInternalTags = async ({ spaceId, libraryId }: {
  spaceId: string;
  libraryId: number;
}) => {
  try {
    const client = getMapiClient();
    return await fetchAllPages(
      (page: number) => client.sharedInternalTags.list({
        path: { space_id: Number(spaceId) },
        query: { asset_folder_id: libraryId, page },
        throwOnError: true,
      }),
      data => data?.internal_tags ?? [],
    );
  }
  catch (maybeError) {
    handleAPIError('pull_shared_internal_tags', toError(maybeError));
  }
};

export const createSharedInternalTag = async (tag: SharedInternalTagCreate, { spaceId }: { spaceId: string }) => {
  try {
    const { data } = await getMapiClient().sharedInternalTags.create({
      path: { space_id: Number(spaceId) },
      body: { shared_internal_tag: tag },
      throwOnError: true,
    });
    return data?.internal_tag;
  }
  catch (maybeError) {
    handleAPIError('push_shared_internal_tag', toError(maybeError));
  }
};
