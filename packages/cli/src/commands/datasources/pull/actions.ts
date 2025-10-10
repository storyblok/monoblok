import { handleAPIError, handleFileSystemError } from '../../../utils';
import { mapiClient } from '../../../api';
import { join, resolve } from 'node:path';
import { resolvePath, sanitizeFilename, saveToFile } from '../../../utils/filesystem';
import type { SpaceDatasource, SpaceDatasourceEntry } from '../constants';
import type { SaveDatasourcesOptions } from './constants';

/**
 * Fetches entries for a given datasource id in a space.
 * @param spaceId - The space ID
 * @param datasourceId - The datasource ID
 * @returns Array of datasource entries
 */
export const fetchDatasourceEntries = async (
  spaceId: string,
  datasourceSlug: string,
): Promise<SpaceDatasourceEntry[] | undefined> => {
  try {
    const client = mapiClient();
    const { data } = await client.datasourceEntries.list({
      path: {
        space_id: spaceId,
      },
      query: {
        datasource_slug: datasourceSlug,
      },
      throwOnError: true,
    });
    return data?.datasource_entries;
  }
  catch (error) {
    // Use 'pull_datasources' as the closest valid action for datasource entries errors
    handleAPIError('pull_datasources', error as Error);
  }
};

export const fetchDatasources = async (spaceId: string): Promise<SpaceDatasource[] | undefined> => {
  try {
    const client = mapiClient();
    const { data } = await client.datasources.list({
      path: {
        space_id: spaceId,
      },
      throwOnError: true,
    });
    const datasources = data?.datasources;
    // Fetch entries for each datasource in parallel
    const datasourcesWithEntries = await Promise.all(
      datasources?.map(async (ds) => {
        if (!ds.slug) {
          return { ...ds, entries: [] };
        }
        const entries = await fetchDatasourceEntries(spaceId, ds.slug);
        return { ...ds, entries };
      }) || [],
    );
    return datasourcesWithEntries;
  }
  catch (error) {
    handleAPIError('pull_datasources', error as Error);
  }
};

export const fetchDatasource = async (spaceId: string, datasourceName: string): Promise<SpaceDatasource | undefined> => {
  try {
    const client = mapiClient();
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
    const entries = await fetchDatasourceEntries(spaceId, found.slug as string);
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
  const { filename = 'datasources', suffix, path, separateFiles } = options;
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
