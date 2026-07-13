import { handleAPIError, handleFileSystemError } from '../../../utils';
import { getMapiClient } from '../../../api';
import { join, resolve } from 'pathe';
import { resolvePath, sanitizeFilename, saveToFile } from '../../../utils/filesystem';
import { fetchAllPages } from '../../../utils/pagination';
import type { DatasourceEntry, SpaceDatasource, SpaceDatasourceEntry } from '../constants';
import { DEFAULT_DATASOURCES_FILENAME } from '../constants';
import type { SaveDatasourcesOptions } from './constants';

/**
 * Fetches entries for a given datasource id in a space.
 * @param spaceId - The space ID
 * @param datasourceId - The datasource ID
 * @param dimensionId - Optional dimension id; when provided the API fills each
 *   entry's `dimension_value` with the value for that dimension
 * @returns Array of datasource entries
 */
export const fetchDatasourceEntries = async (
  spaceId: string,
  datasourceId: number,
  dimensionId?: number,
): Promise<DatasourceEntry[] | undefined> => {
  try {
    const client = getMapiClient();
    return await fetchAllPages(
      (page: number) => client.datasourceEntries.list({
        path: {
          space_id: Number(spaceId),
        },
        query: {
          datasource_id: datasourceId,
          page,
          // MAPI matches `dimension` against the numeric dimension id.
          ...(dimensionId != null && { dimension: String(dimensionId) }),
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

/**
 * Fetches a datasource's entries with their values for every defined dimension.
 * Runs the default (dimensionless) pass, then one pass per dimension, merging
 * each non-empty `dimension_value` into `entry.dimension_values` keyed by the
 * dimension code (`entry_value`). Dimension passes run sequentially to avoid
 * multiplying request volume against the rate limit.
 * @param spaceId - The space ID
 * @param datasource - The datasource, including its `dimensions`
 * @returns Array of local datasource entries
 */
const fetchDatasourceEntriesWithDimensions = async (
  spaceId: string,
  datasource: SpaceDatasource,
): Promise<SpaceDatasourceEntry[]> => {
  const defaultEntries = await fetchDatasourceEntries(spaceId, datasource.id) ?? [];
  // Drop the transient scalar `dimension_value`; per-dimension values are
  // stored in `dimension_values` instead.
  const entries: SpaceDatasourceEntry[] = defaultEntries.map(({ dimension_value, ...rest }) => rest);

  const dimensions = datasource.dimensions ?? [];
  if (!dimensions.length) {
    return entries;
  }

  const entriesById = new Map(entries.map(entry => [entry.id, entry]));

  for (const dimension of dimensions) {
    if (dimension.id == null || !dimension.entry_value) {
      continue;
    }
    const dimensionEntries = await fetchDatasourceEntries(spaceId, datasource.id, dimension.id) ?? [];
    for (const dimensionEntry of dimensionEntries) {
      const value = dimensionEntry.dimension_value;
      if (!value) {
        continue;
      }
      const entry = entriesById.get(dimensionEntry.id);
      if (!entry) {
        continue;
      }
      entry.dimension_values ??= {};
      entry.dimension_values[dimension.entry_value] = value;
    }
  }

  return entries;
};

export const fetchDatasources = async (spaceId: string): Promise<SpaceDatasource[] | undefined> => {
  try {
    const client = getMapiClient();
    const datasources = await fetchAllPages(
      (page: number) => client.datasources.list({
        path: {
          space_id: Number(spaceId),
        },
        query: {
          page,
        },
        throwOnError: true,
      }),
      data => data.datasources || [],
    );
    // Fetch entries for each datasource in parallel
    const datasourcesWithEntries = await Promise.all(
      datasources.map(async (ds: SpaceDatasource) => {
        if (!ds.id) {
          return { ...ds, entries: [] };
        }
        const entries = await fetchDatasourceEntriesWithDimensions(spaceId, ds);
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
    const matches = await fetchAllPages(
      (page: number) => client.datasources.list({
        path: {
          space_id: Number(spaceId),
        },
        query: {
          page,
          search: datasourceName,
        },
        throwOnError: true,
      }),
      data => data.datasources || [],
    );
    const found = matches.find((d: SpaceDatasource) => d.name === datasourceName);
    if (!found) { return undefined; }
    // Fetch entries for the found datasource
    const entries = await fetchDatasourceEntriesWithDimensions(spaceId, found);
    return { ...found, entries };
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
