import { mapiClient } from '../../../api';
import { handleAPIError } from '../../../utils';

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
