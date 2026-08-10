import { CommandError } from '../../utils';
import { OAUTH_CLIENT_ID, OAUTH_CLIENT_PLACEHOLDER_PREFIX, OAUTH_CLIENT_SECRET } from './constants';
import type { OAuthClientCredentials } from './store';
import { getOAuthClientFromEnv } from './store';

// Resolution order: env vars first (for development against another app or a self-hosted
// instance), then the first-party client baked into the CLI. Users never configure anything.
export const resolveOAuthClient = (): OAuthClientCredentials => {
  const fromEnv = getOAuthClientFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  if (OAUTH_CLIENT_ID.startsWith(OAUTH_CLIENT_PLACEHOLDER_PREFIX)) {
    throw new CommandError(
      `This build of the CLI ships without OAuth client credentials, so \`--oauth\` cannot be used yet.\n`
      + `Log in with a Personal Access Token (\`storyblok login --token <token>\`), or set the `
      + `STORYBLOK_OAUTH_CLIENT_ID and STORYBLOK_OAUTH_CLIENT_SECRET environment variables to use your own OAuth app.`,
    );
  }

  return { client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET };
};
