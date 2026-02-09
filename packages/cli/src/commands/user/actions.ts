import chalk from 'chalk';
import type { Users } from '@storyblok/management-api-client';
import { FetchError } from '../../utils/fetch';
import { APIError, maskToken } from '../../utils';
import { creategetMapiClient } from '../../api';
import type { RegionCode } from '../../constants';

export type User = Users.User;

export const getUser = async (token: string, region: RegionCode) => {
  try {
    const client = creategetMapiClient({
      token: {
        accessToken: token,
      },
      region,
    });

    const { data } = await client.users.me({
      throwOnError: true,
    });

    return data?.user;
  }
  catch (error) {
    if (error instanceof FetchError) {
      const status = error.response.status;

      switch (status) {
        case 401:
          throw new APIError('unauthorized', 'get_user', error, `The token provided ${chalk.bold(maskToken(token))} is invalid.
        Please make sure you are using the correct token and try again.`);
        default:
          throw new APIError('network_error', 'get_user', error);
      }
    }

    // Handle specific error strings/responses from the management API client
    if (typeof error === 'string' && error === 'Unauthorized') {
      // Create a mock FetchError for consistency
      const mockFetchError = new FetchError('Non-JSON response', {
        status: 401,
        statusText: 'Unauthorized',
        data: null,
      });
      throw new APIError('unauthorized', 'get_user', mockFetchError, `The token provided ${chalk.bold(maskToken(token))} is invalid.
        Please make sure you are using the correct token and try again.`);
    }

    // Handle network/server errors (empty response objects)
    if (typeof error === 'object' && error !== null && Object.keys(error).length === 0) {
      // Create a mock FetchError for network errors
      const mockFetchError = new FetchError('Network Error', {
        status: 500,
        statusText: 'Internal Server Error',
        data: null,
      });
      throw new APIError('network_error', 'get_user', mockFetchError);
    }

    throw new APIError('generic', 'get_user', error as FetchError);
  }
};
