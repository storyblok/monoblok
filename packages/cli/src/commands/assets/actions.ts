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
