import { basename, dirname, extname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { toError } from '../../utils/error/error';
import { sanitizeFilename } from '../../utils/filesystem';
import { loadManifest } from '../stories/push/actions';
import type { Asset, AssetFolder, AssetMap, AssetMapped } from './types';

export const parseAssetData = (raw?: string) => {
  if (!raw) {
    return {} as Partial<Asset>;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Asset data must be a JSON object.');
    }
    return parsed as Partial<Asset>;
  }
  catch (maybeError) {
    throw new Error(`Invalid --data JSON: ${(toError(maybeError)).message}`);
  }
};

export const loadSidecarAssetData = async (assetSource: string) => {
  const sidecarPath = join(dirname(assetSource), `${basename(assetSource, extname(assetSource))}.json`);
  try {
    const sidecarRaw = await readFile(sidecarPath, 'utf8');
    try {
      return parseAssetData(sidecarRaw);
    }
    catch (maybeError) {
      throw new Error(`Invalid sidecar JSON: ${toError(maybeError).message}`);
    }
  }
  catch (maybeError) {
    const error = toError(maybeError) as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return {};
    }
    throw new Error(`Failed to read sidecar asset data: ${error.message}`);
  }
};

export const isRemoteSource = (assetSource: string) => {
  try {
    const url = new URL(assetSource);
    return url.protocol === 'http:' || url.protocol === 'https:';
  }
  catch {
    return false;
  }
};

export const loadAssetMap = async (manifestFile: string): Promise<AssetMap> => {
  const assetManifest = await loadManifest(manifestFile);

  return new Map<number, { old: AssetMapped; new: AssetMapped }>([
    ...assetManifest
      .map(e => [
        Number(e.old_id),
        {
          old: { id: Number(e.old_id), filename: e.old_filename || '' },
          new: { id: Number(e.new_id), filename: e.new_filename || '' },
        },
      ] as const)
      .filter(([oldId, map]) => !Number.isNaN(oldId) && !Number.isNaN(map.new.id)),
  ]) as AssetMap;
};

/**
 * Extracts the sanitized name and extension from an asset.
 * Uses short_filename if available, otherwise falls back to the filename basename.
 */
export const getAssetNameAndExt = (asset: Pick<Asset, 'id' | 'filename' | 'short_filename'>) => {
  const nameWithExt = asset.short_filename || basename(asset.filename);
  const ext = extname(nameWithExt);
  const name = sanitizeFilename(nameWithExt.replace(ext, '') || String(asset.id));
  return { name, ext };
};

/**
 * Generates the asset binary filename in the format: `${name}_${id}${ext}`
 */
export const getAssetFilename = (asset: Pick<Asset, 'id' | 'filename' | 'short_filename'>) => {
  const { name, ext } = getAssetNameAndExt(asset);
  return `${name}_${asset.id}${ext}`;
};

/**
 * Generates the asset metadata filename in the format: `${name}_${id}.json`
 */
export const getAssetMetadataFilename = (asset: Pick<Asset, 'id' | 'filename' | 'short_filename'>) => {
  const { name } = getAssetNameAndExt(asset);
  return `${name}_${asset.id}.json`;
};

/**
 * Generates the folder filename in the format: `${sanitizedName}_${uuid}.json`
 * Falls back to uuid if the sanitized name is empty.
 */
export const getFolderFilename = (folder: Pick<AssetFolder, 'name' | 'uuid'>) => {
  const sanitizedName = sanitizeFilename(folder.name || '');
  const baseName = sanitizedName || folder.uuid;
  return `${baseName}_${folder.uuid}.json`;
};
