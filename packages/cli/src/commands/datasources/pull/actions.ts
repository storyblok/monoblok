import { handleAPIError } from '../../../utils';
import { mapiClient } from '../../../api';
import type { SpaceDatasource } from '../constants';

export const fetchDatasources = async (space: string): Promise<SpaceDatasource[] | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.get<{
      datasources: SpaceDatasource[];
    }>(`spaces/${space}/datasources`);
    return data.datasources;
  }
  catch (error) {
    handleAPIError('pull_datasources', error as Error);
  }
};
