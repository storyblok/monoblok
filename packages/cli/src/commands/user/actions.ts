import chalk from 'chalk';
import { FetchError } from '../../utils/fetch';
import { APIError, maskToken } from '../../utils';
import { mapiClient } from '../../api';
import type { Users } from '@storyblok/management-api-client';
import type { RegionCode } from '../../constants';

export type User = Users.User;

export const getUser = async (token: string, region: RegionCode) => {
  try {
    const client = mapiClient({
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
    throw new APIError('generic', 'get_user', error as FetchError);
  }
};
