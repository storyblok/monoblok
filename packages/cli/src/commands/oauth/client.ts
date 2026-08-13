import { CommandError } from "../../utils";
import { OAUTH_CLIENT_ID, OAUTH_CLIENT_PLACEHOLDER_PREFIX, OAUTH_CLIENT_SECRET } from "./constants";
import type { OAuthClientCredentials } from "./store";
import { getOAuthClientFromEnv } from "./store";

// Resolution order: env vars first (for development against another app or a self-hosted
// instance), then the first-party client baked into the CLI. Users never configure anything.
export const resolveOAuthClient = (): OAuthClientCredentials => {
  const fromEnv = getOAuthClientFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  if (OAUTH_CLIENT_ID.startsWith(OAUTH_CLIENT_PLACEHOLDER_PREFIX)) {
    // Cause only. Each caller appends the consequence and remedy, because only the caller
    // knows whether the user was logging in, refreshing a session, or revoking one.
    throw new CommandError("This build of the CLI ships without OAuth client credentials.");
  }

  return { client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET };
};
