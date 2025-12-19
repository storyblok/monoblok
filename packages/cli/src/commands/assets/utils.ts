import { basename, dirname, extname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { toError } from '../../utils/error/error';
import type { Asset } from './types';

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
