import chalk from 'chalk';
import { getResponseStatus, handleAPIError, maskToken, toError } from '../../utils';
import { createMapiClient } from '../../api';
import type { RegionCode } from '../../constants';

export type { User } from '../../types';

export const getUser = async (token: string, region: RegionCode) => {
  try {
    const client = createMapiClient({
      personalAccessToken: token,
      region,
    });

    const { data } = await client.users.me({
      throwOnError: true,
    });

    return data?.user;
  }
  catch (maybeError) {
    const error = toError(maybeError);
    const status = getResponseStatus(maybeError);
    const customMessage = status === 401
      ? `The token provided ${chalk.bold(maskToken(token))} is invalid.
        Please make sure you are using the correct token and try again.`
      : undefined;
    handleAPIError('get_user', error, customMessage);
  }
};
