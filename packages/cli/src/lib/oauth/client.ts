import { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } from "./constants";
import type { OAuthClientCredentials } from "./store";
import { getOAuthClientFromEnv } from "./store";

// Resolution order: env vars first (for development against another app or a self-hosted
// instance), then the first-party client baked into the CLI. Users never configure anything.
export const resolveOAuthClient = (): OAuthClientCredentials => {
  return (
    getOAuthClientFromEnv() ?? { client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }
  );
};
