import { Buffer } from 'node:buffer';
import { basename } from 'node:path';
import type { RegionCode } from '../../constants';
import { managementApiRegions } from '../../constants';
import { mapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';
import { toError } from '../../utils/error/error';
import type { Asset, AssetCreate, AssetFolder, AssetFolderCreate, AssetFolderUpdate, AssetsQueryParams, AssetUpdate, AssetUpload } from './types';
import type { SignedResponseObject } from '@storyblok/management-api-client/resources/assets';
import { createHash } from 'node:crypto';

/**
 * Fetches a single page of assets from Storyblok Management API.
 */
export const fetchAssets = async ({ spaceId, params }: {
  spaceId: string;
  params?: AssetsQueryParams;
}) => {
  try {
    const client = mapiClient();
    const { data, response } = await client.assets.list({
      path: {
        space_id: spaceId,
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

export const fetchAssetFile = async (filename: Asset['filename']) => {
  const response = await fetch(filename);
  if (!response.ok) {
    throw new Error(`Failed to download ${filename}`);
  }
  return response.arrayBuffer();
};

// TODO implement in mapi client
export const fetchAssetFolders = async ({ spaceId, token, region }: {
  spaceId: string;
  token: string;
  region: RegionCode;
}) => {
  try {
    const apiHost = managementApiRegions[region];
    const url = new URL(`https://${apiHost}/v1/spaces/${spaceId}/asset_folders`);
    const response = await fetch(url, {
      headers: {
        Authorization: token,
      },
    });
    if (!response.ok) {
      handleAPIError('pull_asset_folders', new Error(response.statusText));
    }
    const data = await response.json() as { asset_folders: AssetFolder[] };
    return {
      asset_folders: data.asset_folders,
      headers: response.headers,
    };
  }
  catch (maybeError) {
    handleAPIError('pull_asset_folders', toError(maybeError));
  }
};

// TODO implement in mapi client
export const createAssetFolder = async (folder: AssetFolderCreate, {
  spaceId,
  token,
  region,
}: {
  spaceId: string;
  token: string;
  region: RegionCode;
}) => {
  try {
    const apiHost = managementApiRegions[region];
    const response = await fetch(`https://${apiHost}/v1/spaces/${spaceId}/asset_folders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({ asset_folder: folder }),
    });
    if (!response.ok) {
      throw new Error('Failed to create asset folder');
    }
    const data = await response.json() as { asset_folder: AssetFolder };
    return data.asset_folder;
  }
  catch (error) {
    handleAPIError('push_asset_folder', error as Error);
  }
};

// TODO implement in mapi client
export const updateAssetFolder = async (folder: AssetFolderUpdate, {
  spaceId,
  token,
  region,
}: {
  spaceId: string;
  token: string;
  region: RegionCode;
}) => {
  try {
    const apiHost = managementApiRegions[region];
    const response = await fetch(`https://${apiHost}/v1/spaces/${spaceId}/asset_folders/${folder.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({ asset_folder: folder }),
    });
    if (!response.ok) {
      throw new Error('Failed to update asset folder');
    }

    // The asset folders endpoint does not return the updated asset folder.
    return folder;
  }
  catch (error) {
    handleAPIError('push_asset_folder', error as Error);
  }
};

const requestAssetUpload = async (asset: AssetUpload, { spaceId }: {
  spaceId: string;
}) => {
  try {
    const client = mapiClient();
    const { data } = await client.assets.upload({
      path: {
        space_id: spaceId,
      },
      body: {
        // @ts-expect-error Our types are wrong, id is optional but allowed.
        id: asset.id,
        filename: asset.short_filename,
        asset_folder_id: asset.asset_folder_id ?? undefined,
      },
      throwOnError: true,
    });

    const signedUpload = data;
    if (!signedUpload?.id || !signedUpload?.post_url || !signedUpload?.fields) {
      throw new Error('Failed to request signed upload!');
    }

    return signedUpload;
  }
  catch (maybeError) {
    handleAPIError('push_asset_sign', toError(maybeError));
  }
};

const uploadAssetToS3 = async (asset: AssetUpload, fileBuffer: ArrayBuffer, {
  signedUpload,
}: {
  signedUpload: SignedResponseObject;
}) => {
  if (!signedUpload?.id || !signedUpload?.post_url || !signedUpload?.fields) {
    throw new Error('Invalid signed upload!');
  }

  const formData = new FormData();
  for (const [key, value] of Object.entries(signedUpload.fields)) {
    formData.append(key, value as string | Blob);
  }
  const contentType = signedUpload.fields['Content-Type'] as string || 'application/octet-stream';
  formData.append('file', new File([Buffer.from(fileBuffer)], asset.short_filename, { type: contentType }));

  const response = await fetch(signedUpload.post_url, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    handleAPIError('push_asset_upload', new Error('Failed to upload asset to storage'));
    return;
  }
  return response;
};

const finishAssetUpload = async (assetId: number, {
  spaceId,
}: {
  spaceId: string;
}) => {
  try {
    const client = mapiClient();
    await client.assets.finalize({
      path: {
        space_id: spaceId,
        signed_response_object_id: String(assetId),
      },
      throwOnError: true,
    });
    const { data } = await client.assets.get({
      path: {
        space_id: spaceId,
        asset_id: assetId,
      },
      throwOnError: true,
    });

    return data as Asset;
  }
  catch (maybeError) {
    handleAPIError('push_asset_finish', toError(maybeError));
  }
};

const uploadAsset = async (asset: AssetUpload, fileBuffer: ArrayBuffer, { spaceId }: { spaceId: string }) => {
  const signed = await requestAssetUpload(asset, {
    spaceId,
  });
  if (!signed) {
    throw new Error('Requesting an asset upload failed!');
  }

  const uploadResponse = await uploadAssetToS3(asset, fileBuffer, {
    signedUpload: signed,
  });
  if (!uploadResponse?.ok) {
    return;
  }

  return finishAssetUpload(Number(signed.id), {
    spaceId,
  });
};

const sha256 = (data: ArrayBuffer | Buffer) => {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return createHash('sha256').update(buffer).digest('hex');
};

export const updateAsset = async (asset: AssetUpdate, fileBuffer: ArrayBuffer | null, { spaceId }: {
  spaceId: string;
}) => {
  try {
    const assetWithNewFilename = { ...asset };
    const remoteFileBuffer = fileBuffer && await fetchAssetFile(asset.filename);
    const hasNewFile = remoteFileBuffer && sha256(fileBuffer) !== sha256(remoteFileBuffer);
    if (hasNewFile) {
      // TODO check if this automatically updates the filename
      const uploadedAsset = await uploadAsset({
        id: asset.id,
        asset_folder_id: asset.asset_folder_id,
        short_filename: asset.short_filename || basename(asset.filename),
      }, fileBuffer, { spaceId });
      if (!uploadedAsset) {
        throw new Error('Uploading the asset failed!');
      }

      assetWithNewFilename.filename = uploadedAsset.filename;
      assetWithNewFilename.short_filename = uploadedAsset.short_filename;
    }

    const client = mapiClient();
    await client.assets.update({
      path: {
        space_id: spaceId,
        asset_id: assetWithNewFilename.id,
      },
      body: {
        asset: assetWithNewFilename,
      },
      throwOnError: true,
    });

    // The assets endpoint does not return the updated asset.
    return assetWithNewFilename;
  }
  catch (maybeError) {
    handleAPIError('push_asset_update', toError(maybeError));
  }
};

export const createAsset = async (
  asset: AssetCreate,
  fileBuffer: ArrayBuffer,
  { spaceId }: { spaceId: string },
) => {
  const createdAsset = await uploadAsset({
    asset_folder_id: asset.asset_folder_id,
    short_filename: asset.short_filename,
  }, fileBuffer, { spaceId });

  if (!createdAsset) {
    throw new Error('Creating the asset failed!');
  }

  if (asset.meta_data && Object.values(asset.meta_data).length > 0) {
    const updatedAsset = await updateAsset(createdAsset, null, {
      spaceId,
    });
    if (!updatedAsset) {
      throw new Error('Updating the created asset failed!');
    }
    return updatedAsset;
  }

  return createdAsset;
};
