import type { RegionCode } from "../../constants";
import { CommandError } from "../../utils";
import { getLogger } from "../logger/logger";
import { getUI } from "../ui";
import { isExpiringSoon } from "./expiry";
import { refreshOAuthTokens } from "./refresh";
import type { OAuthTokens } from "./store";

// Two windows, so a long-running command never stalls on a refresh it could have done
// earlier: inside the background window the cached token is still served while a refresh
// runs, and only inside the blocking window does a request wait for the new token.
const BLOCKING_REFRESH_SKEW_MS = 60_000;
const BACKGROUND_REFRESH_SKEW_MS = 180_000;

export interface OAuthTokenState {
  oauthAccessToken?: string;
  oauthExpiresAt?: string;
}

/**
 * Builds the credential the management API client calls before every request, so a
 * token that expires mid-command is refreshed without recreating the client.
 * @param region - The region whose OAuth session is being used.
 * @param state - Session state the refreshed tokens are written back to.
 */
export const createOAuthTokenProvider = (
  region: RegionCode,
  state: OAuthTokenState,
): (() => Promise<string>) => {
  let backgroundRefresh: Promise<void> | undefined;
  let reportedRefreshFailure = false;

  const apply = (tokens: OAuthTokens): void => {
    state.oauthAccessToken = tokens.access_token;
    state.oauthExpiresAt = tokens.expires_at;
  };

  const refreshInBackground = (): void => {
    if (backgroundRefresh) {
      return;
    }
    backgroundRefresh = refreshOAuthTokens(region)
      .then(apply)
      .catch((error: Error) => {
        // Nothing to surface yet: the token still works. Once it enters the blocking
        // window the next request retries the refresh and reports the failure there.
        getLogger().warn("Background OAuth token refresh failed", { message: error.message });
      })
      .finally(() => {
        backgroundRefresh = undefined;
      });
  };

  return async (): Promise<string> => {
    if (isExpiringSoon(state.oauthExpiresAt, BLOCKING_REFRESH_SKEW_MS)) {
      try {
        apply(await refreshOAuthTokens(region));
      } catch (error) {
        // Commands differ in how much of a failed request they report, and some only
        // count it as a failed item. Say it once here so a dead session is never silent.
        if (!reportedRefreshFailure) {
          reportedRefreshFailure = true;
          getUI().warn((error as Error).message);
        }
        throw error;
      }
    } else if (isExpiringSoon(state.oauthExpiresAt, BACKGROUND_REFRESH_SKEW_MS)) {
      refreshInBackground();
    }

    if (!state.oauthAccessToken) {
      throw new CommandError("No OAuth access token available. Run `storyblok login` again.");
    }
    return state.oauthAccessToken;
  };
};
