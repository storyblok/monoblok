import type { Asset } from '@storyblok/management-api-client/resources/assets';

import { readLocalJsonFiles, writeLocalJsonFile } from './local-utils';

function getAssetFilename(asset: Pick<Asset, 'id' | 'short_filename'>): string {
  const name = (asset.short_filename || String(asset.id)).replace(
    /\.[^.]+$/,
    '',
  ); // strip extension
  return `${name}_${asset.id}.json`;
}

export async function getLocalAssets(dir: string): Promise<Asset[]> {
  return readLocalJsonFiles<Asset>(dir);
}

export async function updateLocalAsset(
  dir: string,
  asset: Asset,
): Promise<void> {
  await writeLocalJsonFile(dir, getAssetFilename(asset), asset);
}
