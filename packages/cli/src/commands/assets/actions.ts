import { Buffer } from 'node:buffer';
import { basename } from 'node:path';
import Storyblok from 'storyblok-js-client';
import { mapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';
import { toError } from '../../utils/error/error';
import type { RegionCode } from '../../constants';
import type { Asset, AssetCreate, AssetFolderCreate, AssetFolderUpdate, AssetsQueryParams, AssetUpdate, AssetUpload } from './types';
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
    throw maybeError;
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
    throw maybeError;
  }
};

export const fetchAssetFolders = async ({ spaceId }: {
  spaceId: string;
}) => {
  try {
    const client = mapiClient();
    const { data, response } = await client.assetFolders.list({
      path: {
        space_id: spaceId,
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
    throw maybeError;
  }
};

export const createAssetFolder = async (folder: AssetFolderCreate, {
  spaceId,
}: {
  spaceId: string;
}) => {
  try {
    const client = mapiClient();
    const { data } = await client.assetFolders.create({
      path: {
        space_id: spaceId,
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
    throw maybeError;
  }
};

export const updateAssetFolder = async (folder: AssetFolderUpdate, {
  spaceId,
}: {
  spaceId: string;
}) => {
  try {
    const client = mapiClient();
    await client.assetFolders.update({
      path: {
        asset_folder_id: folder.id,
        space_id: spaceId,
      },
      body: { asset_folder: folder },
      throwOnError: true,
    });

    return folder;
  }
  catch (maybeError) {
    handleAPIError('push_asset_folder', toError(maybeError));
    throw maybeError;
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
    throw maybeError;
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
    throw maybeError;
  }
};

const uploadAsset = async (asset: AssetUpload, fileBuffer: ArrayBuffer, { spaceId }: { spaceId: string }) => {
  const signed = await requestAssetUpload(asset, {
    spaceId,
  });

  const uploadResponse = await uploadAssetToS3(asset, fileBuffer, {
    signedUpload: signed,
  });
  if (!uploadResponse?.ok) {
    throw new Error('Error uploading asset to S3!');
  }

  return finishAssetUpload(Number(signed.id), {
    spaceId,
  });
};

const sha256 = (data: ArrayBuffer | Buffer) => {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return createHash('sha256').update(buffer).digest('hex');
};

/**
 * Updates an existing asset in Storyblok.
 *
 * When providing a non-null {@link fileBuffer}, the function will compare the
 * local file buffer with the remote asset file and, if they differ, upload
 * the new file before updating the asset metadata.
 *
 * When {@link fileBuffer} is `null`, no file upload is performed and only the
 * asset metadata (e.g. `meta_data`, `asset_folder_id`, etc.) is updated.
 *
 * @param asset - The asset fields to update, including its `id`.
 * @param fileBuffer - The new file contents as an `ArrayBuffer`, or `null` if
 *   only metadata should be updated without changing the underlying file.
 * @param options - Additional options.
 * @param options.spaceId - The ID of the space that owns the asset.
 */
export const updateAsset = async (asset: AssetUpdate, fileBuffer: ArrayBuffer | null, {
  spaceId,
  assetToken,
  region,
}: {
  spaceId: string;
  assetToken?: string;
  region?: RegionCode;
}) => {
  try {
    const assetWithNewFilename = { ...asset };
    let signedUrl: string | undefined;
    if (asset.is_private) {
      if (!assetToken) {
        throw new Error(`Asset ${asset.filename} is private but no asset token was provided. Use --asset-token to provide a token.`);
      }
      signedUrl = await getSignedAssetUrl(asset.filename, assetToken, region);
    }

    const remoteFileBuffer = fileBuffer && await downloadFile(signedUrl || asset.filename);
    const hasNewFile = remoteFileBuffer && fileBuffer && sha256(fileBuffer) !== sha256(remoteFileBuffer);
    if (hasNewFile) {
      const uploadedAsset = await uploadAsset({
        id: asset.id,
        asset_folder_id: asset.asset_folder_id,
        short_filename: asset.short_filename || basename(asset.filename),
      }, fileBuffer, { spaceId });
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
    throw maybeError;
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

  if (asset.meta_data && Object.values(asset.meta_data).length > 0) {
    const updatedAsset = await updateAsset({
      ...asset,
      id: createdAsset.id,
      filename: createdAsset.filename,
    }, null, {
      spaceId,
    });
    if (!updatedAsset) {
      throw new Error('Updating the created asset failed!');
    }
    return updatedAsset;
  }

  return createdAsset;
};
