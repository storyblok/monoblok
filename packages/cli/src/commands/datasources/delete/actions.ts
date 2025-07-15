import { mapiClient } from '../../../api';
import { fetchDatasource } from '../pull/actions';
import { CommandError, handleAPIError } from '../../../utils';

/**
 * Deletes a datasource by id from a Storyblok space.
 * @param space - The space ID
 * @param id - The datasource id
 */
export async function deleteDatasource(space: string, id: string): Promise<void> {
  try {
    const client = mapiClient();
    // Call the Storyblok Management API to delete the datasource by id
    await client.get(`spaces/${space}/datasources/${id}`, { method: 'DELETE' });
  }
  catch (error) {
    handleAPIError('delete_datasource', error as Error, `Datasource with id '${id}' not found in space ${space}.`);
  }
}

/**
 * Deletes a datasource by name from a Storyblok space.
 * Resolves the datasource id by name, then deletes it.
 * @param space - The space ID
 * @param name - The datasource name
 */
export async function deleteDatasourceByName(space: string, name: string): Promise<void> {
  try {
    const client = mapiClient();
    // Resolve datasource by name
    const datasource = await fetchDatasource(space, name);
    if (!datasource) {
      throw new CommandError(`Datasource with name '${name}' not found in space ${space}.`);
    }
    // Call the Storyblok Management API to delete the datasource by resolved id
    await client.delete(`spaces/${space}/datasources/${datasource.id}`);
  }
  catch (error) {
    // 'update_datasource' is the closest allowed action for datasource deletion in API_ACTIONS
    handleAPIError('update_datasource', error as Error, `Failed to delete datasource '${name}'.`);
  }
}
