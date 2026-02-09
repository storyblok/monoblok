import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import type { SpaceDatasource, SpaceDatasourceEntry, SpaceDatasourcesData } from '../constants';
import { DEFAULT_DATASOURCES_FILENAME } from '../constants';
import type { ReadDatasourcesOptions } from './constants';
import { readJsonFile, resolvePath } from '../../../utils/filesystem';
import { getMapiClient } from '../../../api';
import { handleAPIError } from '../../../utils/error/api-error';
import { FileSystemError, handleFileSystemError } from '../../../utils/error/filesystem-error';

export const pushDatasource = async (spaceId: string, datasource: SpaceDatasource): Promise<SpaceDatasource | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.datasources.create({
      path: {
        space_id: spaceId,
      },
      body: { datasource },
      throwOnError: true,
    });

    return data.datasource;
  }
  catch (error) {
    handleAPIError('push_datasource', error as Error, `Failed to push datasource ${datasource.name}`);
  }
};

export const updateDatasource = async (spaceId: string, datasourceId: number, datasource: SpaceDatasource): Promise<SpaceDatasource | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.datasources.update({
      path: {
        space_id: spaceId,
        datasource_id: datasourceId,
      },
      body: {
        datasource,
      },
      throwOnError: true,
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
 * @param spaceId - The space ID
 * @param datasourceId - The datasource ID to add the entry to
 * @param entry - The datasource entry to create
 * @returns The created datasource entry
 */
export const pushDatasourceEntry = async (spaceId: string, datasourceId: number, entry: SpaceDatasourceEntry): Promise<SpaceDatasourceEntry | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.datasourceEntries.create({
      path: {
        space_id: spaceId,
      },
      body: {
        datasource_entry: {
          ...entry,
          datasource_id: datasourceId,
        },
      },
      throwOnError: true,
    });

    return data.datasource_entry;
  }
  catch (error) {
    handleAPIError('push_datasource', error as Error, `Failed to push datasource entry ${entry.name}`);
  }
};

/**
 * Updates an existing datasource entry in the specified space.
 * @param spaceId - The space ID
 * @param entryId - The ID of the entry to update
 * @param entry - The updated datasource entry data
 * @returns it does not return anything
 */
export const updateDatasourceEntry = async (spaceId: string, entryId: number, entry: SpaceDatasourceEntry): Promise<void> => {
  try {
    const client = getMapiClient();
    await client.datasourceEntries.updateDatasourceEntry({
      path: {
        space_id: spaceId,
        datasource_entry_id: entryId,
      },
      body: {
        datasource_entry: entry,
      },
      throwOnError: true,
    });
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
  entry: SpaceDatasourceEntry,
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
  const { from, path, separateFiles = false, suffix } = options;
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
   ${chalk.cyan(`storyblok datasources push --space <target_space> --from ${from}`)}`;

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
      if (file === `${DEFAULT_DATASOURCES_FILENAME}.json` || new RegExp(`^${DEFAULT_DATASOURCES_FILENAME}\\.\\w+\\.json$`).test(file)) {
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
  const datasourcesPath = join(resolvedPath, suffix ? `${DEFAULT_DATASOURCES_FILENAME}.${suffix}.json` : `${DEFAULT_DATASOURCES_FILENAME}.json`);
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
