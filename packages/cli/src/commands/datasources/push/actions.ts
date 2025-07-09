import { readdir } from 'node:fs/promises';
import type { SpaceDatasource, SpaceDatasourceEntry, SpaceDatasourcesData } from '../constants';
import type { ReadDatasourcesOptions } from './constants';
import { readJsonFile, resolvePath } from '../../../utils/filesystem';
import chalk from 'chalk';
import { FileSystemError, handleAPIError, handleFileSystemError } from '../../../utils';
import { join } from 'node:path';
import { mapiClient } from '../../../api';

export const pushDatasource = async (space: string, datasource: SpaceDatasource): Promise<SpaceDatasource | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.post<{
      datasource: SpaceDatasource;
    }>(`spaces/${space}/datasources`, {
      body: JSON.stringify(datasource),
    });

    return data.datasource;
  }
  catch (error) {
    handleAPIError('push_datasource', error as Error, `Failed to push datasource ${datasource.name}`);
  }
};

export const updateDatasource = async (space: string, datasourceId: number, datasource: SpaceDatasource): Promise<SpaceDatasource | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.put<{
      datasource: SpaceDatasource;
    }>(`spaces/${space}/datasources/${datasourceId}`, {
      body: JSON.stringify(datasource),
    });

    return data.datasource;
  }
  catch (error) {
    handleAPIError('update_datasource', error as Error, `Failed to update datasource ${datasource.name}`);
  }
};

export const upsertDatasource = async (space: string, datasource: SpaceDatasource, existingId?: number): Promise<SpaceDatasource | undefined> => {
  if (existingId) {
    return await updateDatasource(space, existingId, datasource);
  }
  else {
    return await pushDatasource(space, datasource);
  }
};

/**
 * Creates a new datasource entry in the specified space.
 * @param space - The space ID
 * @param datasourceId - The datasource ID to add the entry to
 * @param entry - The datasource entry to create
 * @returns The created datasource entry
 */
export const pushDatasourceEntry = async (space: string, datasourceId: number, entry: Omit<SpaceDatasourceEntry, 'id'>): Promise<SpaceDatasourceEntry | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.post<{
      datasource_entry: SpaceDatasourceEntry;
    }>(`spaces/${space}/datasource_entries`, {
      body: JSON.stringify({
        datasource_entry: {
          ...entry,
          datasource_id: datasourceId,
        },
      }),
    });

    return data.datasource_entry;
  }
  catch (error) {
    handleAPIError('push_datasource', error as Error, `Failed to push datasource entry ${entry.name}`);
  }
};

/**
 * Updates an existing datasource entry in the specified space.
 * @param space - The space ID
 * @param entryId - The ID of the entry to update
 * @param entry - The updated datasource entry data
 * @returns it does not return anything
 */
export const updateDatasourceEntry = async (space: string, entryId: number, entry: Omit<SpaceDatasourceEntry, 'id'>): Promise<void> => {
  try {
    const client = mapiClient();

    await client.put<{
      datasource_entry: SpaceDatasourceEntry;
    }>(`spaces/${space}/datasource_entries/${entryId}`, {
      body: JSON.stringify({
        datasource_entry: entry,
      }),
    });
    // The API does not return the updated entry, returns a 204 No Content
  }
  catch (error) {
    handleAPIError('update_datasource', error as Error, `Failed to update datasource entry ${entry.name}`);
  }
};

/**
 * Creates or updates a datasource entry based on whether it already exists.
 * @param space - The space ID
 * @param datasourceId - The datasource ID (only needed for creation)
 * @param entry - The datasource entry to upsert
 * @param existingId - The existing entry ID if updating
 * @returns The created or updated datasource entry
 */
export const upsertDatasourceEntry = async (
  space: string,
  datasourceId: number,
  entry: Omit<SpaceDatasourceEntry, 'id'>,
  existingId?: number,
): Promise<SpaceDatasourceEntry | undefined> => {
  if (existingId) {
    await updateDatasourceEntry(space, existingId, entry);
    return undefined;
  }
  else {
    return await pushDatasourceEntry(space, datasourceId, entry);
  }
};

export const readDatasourcesFiles = async (options: ReadDatasourcesOptions): Promise<SpaceDatasourcesData> => {
  const { from, path, separateFiles = false, suffix, space } = options;
  const resolvedPath = resolvePath(path, `datasources/${from}`);

  // Check if directory exists first
  try {
    await readdir(resolvedPath);
  }
  catch (error) {
    const message = `No local datasources found for space ${chalk.bold(from)}. To push datasources, you need to pull them first:

1. Pull the datasources from your source space:
   ${chalk.cyan(`storyblok datasources pull --space ${from}`)}

2. Then try pushing again:
   ${chalk.cyan(`storyblok datasources push --space ${space} --from ${from}`)}`;

    throw new FileSystemError(
      'file_not_found',
      'read',
      error as Error,
      message,
    );
  }

  if (separateFiles) {
    return await readSeparateFiles(resolvedPath, suffix);
  }

  // TODO: Implement consolidated files reading
  return await readConsolidatedFiles(resolvedPath, suffix);
};

async function readSeparateFiles(resolvedPath: string, suffix?: string): Promise<SpaceDatasourcesData> {
  const files = await readdir(resolvedPath);
  const datasources: SpaceDatasource[] = [];

  const filteredFiles = files.filter((file) => {
    if (suffix) {
      return file.endsWith(`.${suffix}.json`);
    }
    else {
      // Regex to match files with a pattern like .<suffix>.json
      return !/\.\w+\.json$/.test(file);
    }
  });

  for (const file of filteredFiles) {
    const filePath = join(resolvedPath, file);

    if (file.endsWith('.json') || file.endsWith(`${suffix}.json`)) {
      // Skip consolidated files - any file matching datasources.json or datasources.*.json pattern
      if (file === 'datasources.json' || /^datasources\.\w+\.json$/.test(file)) {
        continue;
      }
      const result = await readJsonFile<SpaceDatasource>(filePath);
      if (result.error) {
        handleFileSystemError('read', result.error);
        continue;
      }
      datasources.push(...result.data);
    }
  }

  return {
    datasources,
  };
}

async function readConsolidatedFiles(resolvedPath: string, suffix?: string): Promise<SpaceDatasourcesData> {
  const datasourcesPath = join(resolvedPath, suffix ? `datasources.${suffix}.json` : 'datasources.json');
  const datasourcesResult = await readJsonFile<SpaceDatasource>(datasourcesPath);

  if (datasourcesResult.error || !datasourcesResult.data.length) {
    throw new FileSystemError(
      'file_not_found',
      'read',
      datasourcesResult.error || new Error('Datasources file is empty'),
      `No datasources found in ${datasourcesPath}. Please make sure you have pulled the datasources first.`,
    );
  }

  return {
    datasources: datasourcesResult.data,
  };
}
