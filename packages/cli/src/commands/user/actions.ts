import chalk from 'chalk';
import type { Users } from '@storyblok/management-api-client';
import { handleAPIError, maskToken } from '../../utils';
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
    const status = (error as any)?.response?.status;
    const customMessage = status === 401
      ? `The token provided ${chalk.bold(maskToken(token))} is invalid.
        Please make sure you are using the correct token and try again.`
      : undefined;
    handleAPIError('get_user', error, customMessage);
  }
};
