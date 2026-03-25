import type { Space, SpaceCreate, SpaceUpdate } from '../../types';
import { handleAPIError } from '../../utils';
import { getMapiClient } from '../../api';

export type { Space, SpaceCreate, SpaceUpdate };

export const fetchSpace = async (spaceId: string): Promise<Space | undefined> => {
  try {
    const client = getMapiClient();

    const { data } = await client.spaces.get({
      path: {
        space_id: Number(spaceId),
      },
      throwOnError: true,
    });

    return data?.space;
  }
  catch (error) {
    handleAPIError('pull_spaces', error as Error, `Failed to fetch space ${spaceId}`);
  }
};

/**
 * Creates a new space using the Storyblok Management API
 * @param space - The space creation request data
 * @returns Promise<Space> - The created space data
 */
export const createSpace = async (space: SpaceCreate): Promise<Space | undefined> => {
  try {
    const client = getMapiClient();
    const { data } = await client.spaces.create({
      body: {
        space,
      },
    });

    return data?.space;
  }
  catch (error) {
    handleAPIError('create_space', error as Error, `Failed to create space ${space.name}`);
  }
};
