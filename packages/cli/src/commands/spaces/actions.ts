import type { Spaces } from '@storyblok/management-api-client';
import { handleAPIError } from '../../utils';
import { mapiClient } from '../../api';

export type Space = Spaces.Space;

export const fetchSpace = async (spaceId: string): Promise<Space | undefined> => {
  try {
    const client = mapiClient();

    const { data } = await client.spaces.get({
      path: {
        space_id: spaceId,
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
export const createSpace = async (space: Partial<Space>): Promise<Space | undefined> => {
  try {
    const client = mapiClient();
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
