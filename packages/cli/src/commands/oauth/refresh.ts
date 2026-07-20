import type { RegionCode } from '../../constants';
import { CommandError } from '../../utils';
import { resolveOauthClient } from './client';
import { getOauthEntry, updateOauthEntry } from './store';
import type { OauthTokens } from './store';
import { exchangeToken } from './token-endpoint';

export const computeExpiresAt = (expiresInSeconds: number, nowMs: number = Date.now()): string => {
  return new Date(nowMs + expiresInSeconds * 1000).toISOString();
};

// In-process single-flight: concurrent callers within one CLI process share one refresh.
let inFlight: Promise<OauthTokens> | null = null;

const doRefresh = async (region: RegionCode): Promise<OauthTokens> => {
  const entry = await getOauthEntry(region);
  const refreshToken = entry.tokens?.refresh_token;
  if (!refreshToken) {
    throw new CommandError('No OAuth refresh token stored. Run `storyblok login` to authenticate.');
  }

  const client = await resolveOauthClient(region);

  let response;
  try {
    response = await exchangeToken(region, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: client.client_id,
      client_secret: client.client_secret,
    });
  }
  catch (error) {
    // The refresh token rotates and is single-use; an invalid grant means the session is dead.
    if (error instanceof CommandError && /invalid_grant/.test(error.message)) {
      throw new CommandError('Your OAuth session has expired. Please run `storyblok login` again.');
    }
    throw error;
  }

  const tokens: OauthTokens = {
    auth_type: 'oauth',
    access_token: response.access_token,
    refresh_token: response.refresh_token ?? refreshToken,
    expires_at: computeExpiresAt(response.expires_in),
  };

  // Persist the rotated tokens BEFORE returning them for use.
  await updateOauthEntry(region, { tokens });
  return tokens;
};

export const refreshOauthTokens = async (region: RegionCode): Promise<OauthTokens> => {
  if (!inFlight) {
    inFlight = doRefresh(region).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};
