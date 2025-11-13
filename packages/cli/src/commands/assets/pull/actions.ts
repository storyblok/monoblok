import { basename, join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { handleAPIError, konsola } from '../../../utils';
import { mapiClient } from '../../../api';
import { resolvePath } from '../../../utils/filesystem';
import { Buffer } from 'node:buffer';
/**
 * Represents an asset from the Storyblok Management API
 */
export interface SpaceAsset {
  id: number;
  filename: string;
  alt?: string;
  name?: string;
  title?: string;
  copyright?: string;
  content_type?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  is_private?: boolean;
  is_external_url?: boolean;
}

/**
 * Represents an asset in the manifest with local file information
 */
export interface AssetManifestEntry extends SpaceAsset {
  local_filename: string;
}

/**
 * Generic pagination helper that fetches all pages of data
 * @param fetchFunction - Function that fetches a single page
 * @param extractDataFunction - Function that extracts data array from response
 * @param page - Current page number
 * @param collectedItems - Previously collected items
 * @returns Array of all items across all pages
 */
async function fetchAllPages<T, R>(
  fetchFunction: (page: number) => Promise<{ data: T; response: Response }>,
  extractDataFunction: (data: T) => R[],
  page = 1,
  collectedItems: R[] = [],
): Promise<R[]> {
  const { data, response } = await fetchFunction(page);
  const totalHeader = (response.headers.get('total'));
  const total = Number(totalHeader);

  const fetchedItems = extractDataFunction(data);
  const allItems = [...collectedItems, ...fetchedItems];

  if (!totalHeader || Number.isNaN(total)) {
    // No valid 'total' header — assume not paginated, return all collected items plus current page
    return allItems;
  }

  if (allItems.length < total && fetchedItems.length > 0) {
    return fetchAllPages(fetchFunction, extractDataFunction, page + 1, allItems);
  }
  return allItems;
}

/**
 * Fetches all assets from a space with pagination
 * @param spaceId - The space ID
 * @returns Array of all assets
 */
export const fetchAllAssets = async (spaceId: string): Promise<SpaceAsset[] | undefined> => {
  try {
    const client = mapiClient();
    return await fetchAllPages(
      (page: number) => client.assets.list({
        path: {
          space_id: spaceId,
        },
        query: {
          page,
          per_page: 100,
        },
        throwOnError: true,
      }),
      data => data?.assets || [],
    );
  }
  catch (error) {
    handleAPIError('pull_assets', error as Error);
  }
};

/**
 * Downloads a single asset from its URL and saves it to disk
 * @param asset - The asset to download
 * @param basePath - The base path where assets should be saved
 * @param verbose - Whether to log verbose output
 * @returns The local filename if successful, undefined otherwise
 */
export const downloadAsset = async (
  asset: SpaceAsset,
  basePath: string,
  verbose = false,
): Promise<string | undefined> => {
  // Extract the filename from the URL
  const url = asset.filename;
  if (!url) {
    if (verbose) {
      konsola.warn(`Asset ${asset.id} has no filename URL, skipping`);
    }
    return undefined;
  }

  // Parse the URL to extract just the filename (flat structure)
  const urlObj = new URL(url);
  const filename = basename(urlObj.pathname);
  const localFilePath = join(basePath, filename);

  // Ensure directory exists
  await mkdir(basePath, { recursive: true });

  // Download the file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(localFilePath, buffer);

  if (verbose) {
    konsola.ok(`Downloaded: ${filename}`);
  }

  return filename;
};

/**
 * Downloads all assets from a space to the local filesystem and creates a manifest
 * @param space - The space ID
 * @param assets - Array of assets to download
 * @param path - Custom path for saving assets (optional)
 * @param verbose - Whether to log verbose output
 */
export const saveAssetsToFiles = async (
  space: string,
  assets: SpaceAsset[],
  path?: string,
  verbose = false,
): Promise<void> => {
  // Ensure we always include the assets/space folder structure
  const resolvedPath = path
    ? resolve(process.cwd(), path, 'assets', space)
    : resolvePath(path, `assets/${space}`);

  konsola.info(`Downloading ${assets.length} asset${assets.length === 1 ? '' : 's'} to ${resolvedPath}`);

  let successCount = 0;
  let failCount = 0;
  const manifest: AssetManifestEntry[] = [];

  for (const asset of assets) {
    try {
      const localFilename = await downloadAsset(asset, resolvedPath, verbose);
      if (localFilename) {
        successCount++;
        // Add to manifest with local filename
        manifest.push({
          ...asset,
          local_filename: localFilename,
        });
      }
      else {
        failCount++;
      }
    }
    catch (error) {
      failCount++;
      konsola.error(`Failed to download asset ${asset.id}: ${(error as Error).message}`);
      if (verbose) {
        console.error(error);
      }
    }
  }

  // Save manifest.json
  if (manifest.length > 0) {
    const manifestPath = join(resolvedPath, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    if (verbose) {
      konsola.ok(`Manifest saved to ${manifestPath}`);
    }
  }

  if (successCount > 0) {
    konsola.ok(`Successfully downloaded ${successCount} asset${successCount === 1 ? '' : 's'}`);
  }
  if (failCount > 0) {
    konsola.warn(`Failed to download ${failCount} asset${failCount === 1 ? '' : 's'}`);
  }
};
