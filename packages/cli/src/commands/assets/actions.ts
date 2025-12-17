import { Buffer } from 'node:buffer';
import { basename } from 'node:path';
import type { Asset as MapiAsset } from '@storyblok/management-api-client/resources/assets';
import type { RegionCode } from '../../constants';
import { managementApiRegions } from '../../constants';
import { mapiClient } from '../../api';
import { handleAPIError } from '../../utils/error/api-error';

export type Asset = Required<Pick<MapiAsset, 'id' | 'filename'>> & MapiAsset;

export interface AssetsQueryParams {
  page?: number;
  per_page?: number;
  filter_query?: string;
  starts_with?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface FetchAssetsResult {
  assets: Asset[];
  headers: Headers;
}

export interface AssetFolder {
  id: number;
  uuid: string;
  name: string;
  parent_id: number | null;
  parent_uuid: string | null;
}

export interface FetchAssetFoldersResult {
  asset_folders: AssetFolder[];
  headers: Headers;
}

/**
 * Fetches a single page of assets from Storyblok Management API.
 */
export const fetchAssets = async (
  spaceId: string,
  params?: AssetsQueryParams,
): Promise<FetchAssetsResult | undefined> => {
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

    const assets = (data?.assets || []).filter((asset): asset is Asset => Boolean(asset?.id && asset?.filename));

    return {
      assets,
      headers: response.headers,
    };
  }
  catch (error) {
    handleAPIError('pull_assets', error as Error);
  }
};

// TODO implement in mapi client
export const fetchAssetFolders = async (
  spaceId: string,
  token: string,
  region?: RegionCode,
): Promise<FetchAssetFoldersResult | undefined> => {
  const apiHost = managementApiRegions[region || 'eu'];
  try {
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
      asset_folders: data.asset_folders || [],
      headers: response.headers,
    };
  }
  catch (error) {
    handleAPIError('pull_asset_folders', error as Error);
  }
};

export const fetchAssetFile = async (asset: Asset): Promise<ArrayBuffer | undefined> => {
  const response = await fetch(asset.filename);
  if (!response.ok) {
    throw new Error(`Failed to download asset ${asset.id}`);
  }
  return response.arrayBuffer();
};

export interface SignedAssetUpload {
  id: string | number;
  post_url: string;
  fields: Record<string, string>;
}

// TODO implement in mapi client
export const createAssetFolder = async ({
  spaceId,
  token,
  region,
  folder,
}: {
  spaceId: string;
  token: string;
  region?: RegionCode;
  folder: Pick<AssetFolder, 'name' | 'parent_id'>;
}) => {
  try {
    const apiHost = managementApiRegions[region || 'eu'];
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

interface RequestAssetUploadPayload {
  asset: {
    filename: string;
    size?: string;
    validate_upload?: 1;
    asset_folder_id?: number | null;
  };
}

const requestAssetUpload = async (
  spaceId: string,
  payload: RequestAssetUploadPayload,
): Promise<SignedAssetUpload | undefined> => {
  try {
    const client = mapiClient();
    const { data } = await client.assets.upload({
      path: {
        space_id: spaceId,
      },
      body: {
        filename: payload.asset.filename,
        size: payload.asset.size || '0x0',
        validate_upload: payload.asset.validate_upload ?? 1,
        asset_folder_id: payload.asset.asset_folder_id ?? undefined,
      },
      throwOnError: true,
    });
    const signedUpload = data as { id?: string | number; post_url?: string; fields?: Record<string, unknown> } | undefined;
    if (!signedUpload?.id || !signedUpload?.post_url || !signedUpload?.fields) {
      throw new Error('Failed to request signed upload');
    }
    const fields = Object.entries(signedUpload.fields)
      .reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = String(value);
        return acc;
      }, {});
    return {
      id: signedUpload.id,
      post_url: signedUpload.post_url,
      fields,
    };
  }
  catch (error) {
    handleAPIError('push_asset_sign', error as Error);
  }
};

const uploadAssetToS3 = async ({
  signedUpload,
  fileBuffer,
  filename,
}: {
  signedUpload: SignedAssetUpload;
  fileBuffer: ArrayBuffer;
  filename: string;
}) => {
  const formData = new FormData();
  for (const [key, value] of Object.entries(signedUpload.fields)) {
    formData.append(key, value);
  }
  const contentType = signedUpload.fields['Content-Type'] || 'application/octet-stream';
  formData.append('file', new File([Buffer.from(fileBuffer)], filename, { type: contentType }));

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

const finishAssetUpload = async ({
  spaceId,
  assetId,
}: {
  spaceId: string;
  token?: string;
  region?: RegionCode;
  assetId: number | string;
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
  catch (error) {
    handleAPIError('push_asset_finish', error as Error);
  }
};

export const updateAsset = async (
  spaceId: string,
  payload: {
    assetId: number | string;
    asset: {
      asset_folder_id?: number | null;
      is_private?: boolean;
      meta_data?: Record<string, unknown>;
    };
  },
): Promise<Asset | undefined> => {
  try {
    const client = mapiClient();
    const { data } = await client.assets.update({
      path: {
        space_id: spaceId,
        asset_id: payload.assetId,
      },
      body: {
        asset: {
          asset_folder_id: payload.asset.asset_folder_id ?? undefined,
          is_private: payload.asset.is_private ?? undefined,
          meta_data: payload.asset.meta_data ?? undefined,
        },
      },
      throwOnError: true,
    });

    return data as Asset;
  }
  catch (error) {
    handleAPIError('push_asset_update', error as Error);
  }
};

export const createAsset = async (
  spaceId: string,
  payload: {
    asset: Asset;
    fileBuffer: ArrayBuffer;
  },
): Promise<Asset | undefined> => {
  const filename = payload.asset.short_filename || basename(payload.asset.filename);
  const signed = await requestAssetUpload(spaceId, {
    asset: {
      filename,
      asset_folder_id: payload.asset.asset_folder_id ?? undefined,
      validate_upload: 1,
    },
  });
  if (!signed) {
    return;
  }

  const uploadResponse = await uploadAssetToS3({
    signedUpload: signed,
    fileBuffer: payload.fileBuffer,
    filename,
  });
  if (!uploadResponse?.ok) {
    return;
  }

  const createdAsset = await finishAssetUpload({
    spaceId,
    assetId: signed.id,
  });

  if (!createdAsset) {
    return;
  }

  if (payload.asset.meta_data) {
    const updatedAsset = await updateAsset(spaceId, {
      assetId: createdAsset.id,
      asset: {
        meta_data: payload.asset.meta_data,
      },
    });
    return updatedAsset ?? createdAsset;
  }

  return createdAsset;
};
