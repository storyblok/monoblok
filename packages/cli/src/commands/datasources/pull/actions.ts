import { handleAPIError } from '../../../utils';
import { mapiClient } from '../../../api';
import type { SpaceDatasource, SpaceDatasourceEntry } from '../constants';

/**
 * Fetches entries for a given datasource id in a space.
 * @param space - The space ID
 * @param datasourceId - The datasource ID
 * @returns Array of datasource entries
 */
export const fetchDatasourceEntries = async (
  space: string,
  datasourceId: number,
): Promise<SpaceDatasourceEntry[] | undefined> => {
  try {
    const client = mapiClient();
    const { data } = await client.get<{
      datasource_entries: SpaceDatasourceEntry[];
    }>(`spaces/${space}/datasource_entries?datasource_id=${datasourceId}`);
    return data.datasource_entries;
  }
  catch (error) {
    // Use 'pull_datasources' as the closest valid action for datasource entries errors
    handleAPIError('pull_datasources', error as Error);
  }
};

export const fetchDatasources = async (space: string): Promise<SpaceDatasource[] | undefined> => {
  try {
    const client = mapiClient();
    const { data } = await client.get<{
      datasources: SpaceDatasource[];
    }>(`spaces/${space}/datasources`);
    const datasources = data.datasources;
    // Fetch entries for each datasource in parallel
    const datasourcesWithEntries = await Promise.all(
      datasources.map(async (ds) => {
        const entries = await fetchDatasourceEntries(space, ds.id);
        return { ...ds, entries };
      }),
    );
    return datasourcesWithEntries;
  }
  catch (error) {
    handleAPIError('pull_datasources', error as Error);
  }
};

export const fetchDatasource = async (space: string, datasourceName: string): Promise<SpaceDatasource | undefined> => {
  try {
    const client = mapiClient();
    const { data } = await client.get<{
      datasources: SpaceDatasource[];
    }>(`spaces/${space}/datasources?search=${encodeURIComponent(datasourceName)}`);
    const found = data.datasources?.find(d => d.name === datasourceName);
    if (!found) { return undefined; }
    // Fetch entries for the found datasource
    const entries = await fetchDatasourceEntries(space, found.id);
    return { ...found, entries };
  }
  catch (error) {
    handleAPIError('pull_datasources', error as Error, `Failed to fetch datasource ${datasourceName}`);
  }
};
