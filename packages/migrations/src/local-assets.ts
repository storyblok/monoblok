import { getAssetFilename } from "@storyblok/utils/local-files";

import type { Asset } from "./types";

import { readLocalJsonFiles, writeLocalJsonFile } from "./local-utils";

export async function getLocalAssets(dir: string): Promise<Asset[]> {
  return readLocalJsonFiles<Asset>(dir);
}

export async function updateLocalAsset(dir: string, asset: Asset): Promise<void> {
  await writeLocalJsonFile(dir, getAssetFilename(asset), asset);
}
