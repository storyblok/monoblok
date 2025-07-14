import { mapiClient } from '../../../api';
import { fetchDatasource } from '../pull/actions';
import { CommandError, handleAPIError } from '../../../utils';

/**
 * Deletes a datasource by id (if provided) or by name from a Storyblok space.
 * @param space - The space ID
 * @param name - The datasource name
 * @param id - The datasource id (if provided)
 */
export async function deleteDatasourceByNameOrId(space: string, name: string, id?: string): Promise<void> {
  try {
    const client = mapiClient();
    let datasourceId: number | undefined;

    if (id && !name) {
      datasourceId = Number(id);
      if (Number.isNaN(datasourceId)) {
        throw new CommandError(`Provided id '${id}' is not a valid number.`);
      }
    }
    else {
      // Resolve datasource by name
      const datasource = await fetchDatasource(space, name);
      if (!datasource) {
        throw new CommandError(`Datasource with name '${name}' not found in space ${space}.`);
      }
      datasourceId = datasource.id;
    }

    // Call the Storyblok Management API to delete the datasource
    await client.get(`spaces/${space}/datasources/${datasourceId}`, { method: 'DELETE' });
  }
  catch (error) {
    handleAPIError('update_datasource', error as Error, `Failed to delete datasource '${id || name}'.`);
  }
}
