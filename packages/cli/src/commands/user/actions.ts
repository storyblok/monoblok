import chalk from 'chalk';
import type { ApiCredential } from '../../utils';
import { getResponseStatus, handleAPIError, maskToken, toError } from '../../utils';
import { createMapiClient } from '../../api';
import type { RegionCode } from '../../constants';

export type { User } from '../../types';

/**
 * Fetch the current user.
 * @param credential - A PAT string (back-compat) or an {@link ApiCredential} (PAT or OAuth token).
 * @param region - The region to authenticate against.
 */
export const getUser = async (credential: string | ApiCredential, region: RegionCode) => {
  const config: ApiCredential = typeof credential === 'string' ? { personalAccessToken: credential } : credential;
  const isOauth = 'oauthToken' in config;
  const token = 'personalAccessToken' in config ? config.personalAccessToken : config.oauthToken;
  try {
    const client = createMapiClient({
      ...config,
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
      ? isOauth
        ? `Your OAuth session has expired or been revoked.
        Please run \`storyblok login --oauth\` to authenticate again.`
        : `The token provided ${chalk.bold(maskToken(token))} is invalid.
        Please make sure you are using the correct token and try again.`
      : undefined;
    handleAPIError('get_user', error, customMessage);
  }
};
