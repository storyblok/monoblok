import Storyblok from 'storyblok-js-client';
import { getMapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';
import { toError } from '../../utils/error/error';
import type { RegionCode } from '../../constants';
import type { Asset, AssetFolderCreate, AssetFolderUpdate, AssetListQuery, AssetUpdate, AssetUpload } from './types';

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
    // Strip `id` — it identifies the local/manifest asset for mapping and must
    // not flow into the metadata update inside mapi-client's create().
    const { id: _id, ...assetBody } = asset;
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
