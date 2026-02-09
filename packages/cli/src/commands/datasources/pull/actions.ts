import { handleAPIError, handleFileSystemError } from '../../../utils';
import { getMapiClient } from '../../../api';
import { join, resolve } from 'node:path';
import { resolvePath, sanitizeFilename, saveToFile } from '../../../utils/filesystem';
import type { SpaceDatasource, SpaceDatasourceEntry } from '../constants';
import { DEFAULT_DATASOURCES_FILENAME } from '../constants';
import type { SaveDatasourcesOptions } from './constants';

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
 * Fetches entries for a given datasource id in a space.
 * @param spaceId - The space ID
 * @param datasourceId - The datasource ID
 * @returns Array of datasource entries
 */
export const fetchDatasourceEntries = async (
  spaceId: string,
  datasourceId: number,
): Promise<SpaceDatasourceEntry[] | undefined> => {
  try {
    const client = getMapiClient();
    return await fetchAllPages(
      (page: number) => client.datasourceEntries.list({
        path: {
          space_id: spaceId,
        },
        query: {
          datasource_id: datasourceId,
          page,
        },
        throwOnError: true,
      }),
      data => data?.datasource_entries || [],
    );
  }
  catch (error) {
    // Use 'pull_datasources' as the closest valid action for datasource entries errors
    handleAPIError('pull_datasources', error as Error);
  }
};

export const fetchDatasources = async (spaceId: string): Promise<SpaceDatasource[] | undefined> => {
  try {
    const client = getMapiClient();
    const datasources = await fetchAllPages(
      (page: number) => client.datasources.list({
        path: {
          space_id: spaceId,
        },
        query: {
          page,
        },
        throwOnError: true,
      }),
      data => data?.datasources || [],
    );
    // Fetch entries for each datasource in parallel
    const datasourcesWithEntries = await Promise.all(
      datasources.map(async (ds: any) => {
        if (!ds.id) {
          return { ...ds, entries: [] };
        }
        const entries = await fetchDatasourceEntries(spaceId, ds.id);
        return { ...ds, entries };
      }),
    );
    return datasourcesWithEntries;
  }
  catch (error) {
    handleAPIError('pull_datasources', error as Error);
  }
};

export const fetchDatasource = async (spaceId: string, datasourceName: string): Promise<SpaceDatasource | undefined> => {
  try {
    const client = getMapiClient();
    const { data } = await client.datasources.list({
      path: {
        space_id: spaceId,
      },
      query: {
        search: datasourceName,
      },
      throwOnError: true,
    });
    const found = data?.datasources?.find(d => d.name === datasourceName);
    if (!found) { return undefined; }
    // Fetch entries for the found datasource
    const entries = await fetchDatasourceEntries(spaceId, found.id as number);
    return { ...found, entries: entries || [] } as SpaceDatasource;
  }
  catch (error) {
    handleAPIError('pull_datasources', error as Error, `Failed to fetch datasource ${datasourceName}`);
  }
};

// Filesystem actions

export const saveDatasourcesToFiles = async (
  space: string,
  datasources: SpaceDatasource[],
  options: SaveDatasourcesOptions,
) => {
  const { filename = DEFAULT_DATASOURCES_FILENAME, suffix, path, separateFiles } = options;
  // Ensure we always include the datasources/space folder structure regardless of custom path
  const resolvedPath = path
    ? resolve(process.cwd(), path, 'datasources', space)
    : resolvePath(path, `datasources/${space}`);

  try {
    if (separateFiles) {
      // Save in separate files without nested structure
      for (const datasource of datasources) {
        const sanitizedName = sanitizeFilename(datasource.name || '');
        const datasourceFilePath = join(resolvedPath, suffix ? `${sanitizedName}.${suffix}.json` : `${sanitizedName}.json`);
        await saveToFile(datasourceFilePath, JSON.stringify(datasource, null, 2));
      }
      return;
    }

    // Default to saving consolidated files
    const datasourcesFilePath = join(resolvedPath, suffix ? `${filename}.${suffix}.json` : `${filename}.json`);
    await saveToFile(datasourcesFilePath, JSON.stringify(datasources, null, 2));
  }
  catch (error) {
    handleFileSystemError('write', error as Error);
  }
};
