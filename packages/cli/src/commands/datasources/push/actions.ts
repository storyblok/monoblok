import { readdir } from 'node:fs/promises';
import { join } from 'pathe';
import chalk from 'chalk';
import type { DatasourceEntry, SpaceDatasource, SpaceDatasourceEntry, SpaceDatasourcesData } from '../constants';
import type { DatasourceCreate, DatasourceUpdate } from '../../../types';
import type { ReadDatasourcesOptions } from './constants';
import { filterJsonBySuffix, readJsonFile, resolvePath } from '../../../utils/filesystem';
import { getMapiClient } from '../../../api';
import { handleAPIError } from '../../../utils/error/api-error';
import { FileSystemError, handleFileSystemError } from '../../../utils/error/filesystem-error';

export const pushDatasource = async (spaceId: string, datasource: DatasourceCreate & { dimensions?: SpaceDatasource['dimensions'] }): Promise<SpaceDatasource | undefined> => {
  try {
    const client = getMapiClient();

    const { dimensions, ...datasourceFields } = datasource;
    // The create endpoint models dimensions only through `dimensions_attributes`
    // (name + entry_value); the pulled `dimensions` array (with source-space ids)
    // is otherwise ignored. Map it so a fresh target space gets its dimensions
    // created, with the target assigning new ids. Per-dimension entry values then
    // resolve by dimension code against those ids.
    const dimensionsAttributes = (dimensions ?? [])
      .filter(dimension => dimension.entry_value)
      .map(dimension => ({ name: dimension.name ?? dimension.entry_value ?? '', entry_value: dimension.entry_value ?? '' }));

    const { data } = await client.datasources.create({
      path: {
        space_id: Number(spaceId),
      },
      body: {
        datasource: {
          ...datasourceFields,
          ...(dimensionsAttributes.length > 0 && { dimensions_attributes: dimensionsAttributes }),
        },
      },
      throwOnError: true,
    });

    return data.datasource;
  }
  catch (error) {
    handleAPIError('push_datasource', error as Error, `Failed to push datasource ${datasource.name}`);
  }
};

export const updateDatasource = async (spaceId: string, datasourceId: number, datasource: DatasourceUpdate): Promise<SpaceDatasource | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.datasources.update(datasourceId, {
      path: {
        space_id: Number(spaceId),
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

export const upsertDatasource = async (space: string, datasource: DatasourceCreate & { dimensions?: SpaceDatasource['dimensions'] }, existingId?: number): Promise<SpaceDatasource | undefined> => {
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
 * @param position - Optional position index to control ordering
 * @returns The created datasource entry
 */
export const pushDatasourceEntry = async (spaceId: string, datasourceId: number, entry: SpaceDatasourceEntry, position?: number): Promise<DatasourceEntry | undefined> => {
  try {
    const client = getMapiClient();

    // Per-dimension values are written separately via updateDatasourceEntryDimension.
    const { dimension_values, ...entryFields } = entry;

    const { data } = await client.datasourceEntries.create({
      path: {
        space_id: Number(spaceId),
      },
      body: {
        datasource_entry: {
          ...entryFields,
          value: entry.value ?? '',
          datasource_id: datasourceId,
          ...(position != null && { position }),
        },
      } as any,
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
 * @param position - Optional position index to control ordering
 */
export const updateDatasourceEntry = async (spaceId: string, entryId: number, entry: SpaceDatasourceEntry, position?: number): Promise<void> => {
  try {
    const client = getMapiClient();

    // Per-dimension values are written separately via updateDatasourceEntryDimension.
    const { dimension_values, ...entryFields } = entry;

    await client.datasourceEntries.update(entryId, {
      path: {
        space_id: Number(spaceId),
      },
      body: {
        datasource_entry: {
          ...entryFields,
          ...(position != null && { position }),
        },
      } as any,
      throwOnError: true,
    });
  }
  catch (error) {
    handleAPIError('update_datasource', error as Error, `Failed to update datasource entry ${entry.name}`);
  }
};

/**
 * Writes a single per-dimension value for an entry. The MAPI update endpoint
 * upserts the dimension child row identified by `dimensionId`; a blank
 * `dimensionValue` clears it.
 * @param spaceId - The space ID
 * @param entryId - The ID of the entry to update
 * @param entry - The entry providing `name`/`value` context
 * @param dimensionId - The target dimension id
 * @param dimensionValue - The value to write for that dimension (blank clears)
 */
export const updateDatasourceEntryDimension = async (
  spaceId: string,
  entryId: number,
  entry: SpaceDatasourceEntry,
  dimensionId: number,
  dimensionValue: string,
): Promise<void> => {
  try {
    const client = getMapiClient();
    await client.datasourceEntries.update(entryId, {
      path: {
        space_id: Number(spaceId),
      },
      query: { dimension_id: dimensionId },
      body: {
        datasource_entry: {
          name: entry.name,
          value: entry.value ?? '',
          dimension_value: dimensionValue,
        },
      },
      throwOnError: true,
    });
  }
  catch (error) {
    handleAPIError('update_datasource', error as Error, `Failed to update datasource entry ${entry.name} for dimension ${dimensionId}`);
  }
};

/**
 * Creates or updates a datasource entry based on whether it already exists.
 * @param space - The space ID
 * @param datasourceId - The datasource ID (only needed for creation)
 * @param entry - The datasource entry to upsert
 * @param existingId - The existing entry ID if updating
 * @param position - Optional position index to control ordering
 * @returns The created or updated datasource entry
 */
export const upsertDatasourceEntry = async (
  space: string,
  datasourceId: number,
  entry: SpaceDatasourceEntry,
  existingId?: number,
  position?: number,
): Promise<DatasourceEntry | undefined> => {
  if (existingId) {
    await updateDatasourceEntry(space, existingId, entry, position);
    return undefined;
  }
  else {
    return await pushDatasourceEntry(space, datasourceId, entry, position);
  }
};

/**
 * Deletes a datasource entry from the specified space.
 * @param spaceId - The space ID
 * @param entryId - The ID of the entry to delete
 */
export const deleteDatasourceEntry = async (spaceId: string, entryId: number): Promise<void> => {
  try {
    const client = getMapiClient();
    await client.datasourceEntries.delete(entryId, {
      path: {
        space_id: Number(spaceId),
      },
      throwOnError: true,
    });
  }
  catch (error) {
    handleAPIError('delete_datasource_entry', error as Error, `Failed to delete datasource entry ${entryId}`);
  }
};

function isDatasource(item: unknown): item is SpaceDatasource {
  return typeof item === 'object'
    && item !== null
    && 'slug' in item
    && typeof item.slug === 'string';
}

export const readDatasourcesFiles = async (options: ReadDatasourcesOptions): Promise<SpaceDatasourcesData> => {
  const { from, path, suffix } = options;
  const resolvedPath = resolvePath(path, `datasources/${from}`);

  let files: string[];
  try {
    files = await readdir(resolvedPath);
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

  const datasourceMap = new Map<string, { datasource: SpaceDatasource; file: string }>();
  const duplicates: string[] = [];

  for (const file of filterJsonBySuffix(files, suffix)) {
    const { data, error } = await readJsonFile<unknown>(join(resolvedPath, file));
    if (error) {
      handleFileSystemError('read', error);
      continue;
    }

    for (const item of data) {
      if (isDatasource(item)) {
        const existing = datasourceMap.get(item.slug);
        if (existing) {
          duplicates.push(`Datasource "${item.slug}" found in both "${existing.file}" and "${file}"`);
        }
        datasourceMap.set(item.slug, { datasource: item, file });
      }
    }
  }

  if (duplicates.length) {
    throw new FileSystemError(
      'file_not_found',
      'read',
      new Error('Duplicate datasources detected'),
      `Duplicate datasources found in ${resolvedPath}:\n\n${duplicates.join('\n')}\n\nThis can happen when multiple environment snapshots (e.g. datasources.json and datasources.dev.json) or mixed formats coexist in the same directory.\n\nTo fix this, either:\n  - Use --suffix <env> to target a specific environment (e.g. --suffix dev)\n  - Clean up the directory and pull datasources again in the format you intend`,
    );
  }

  const datasources = [...datasourceMap.values()].map(({ datasource }) => datasource);
  if (!datasources.length) {
    throw new FileSystemError(
      'file_not_found',
      'read',
      new Error('No datasource data found'),
      `No datasources found in ${resolvedPath}. Please make sure you have pulled the datasources first.`,
    );
  }

  return { datasources };
};
