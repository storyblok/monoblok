import type { RegionCode } from '../../constants';
import { CommandError } from '../../utils';
import type { OAuthClientCredentials } from './store';
import { getOAuthClientFromEnv, getOAuthEntry } from './store';

// Resolution order: env vars, then stored client (from `oauth setup`).
// A baked-in first-party client is a planned follow-up and would slot in as the next fallback here.
export const resolveOAuthClient = async (region: RegionCode): Promise<OAuthClientCredentials> => {
  const fromEnv = getOAuthClientFromEnv();
  if (fromEnv) {
    return fromEnv;
  }

  const stored = (await getOAuthEntry(region)).client;
  if (stored) {
    return stored;
  }

  throw new CommandError(
    `No OAuth client credentials found for region "${region}".\n`
    + `Run \`storyblok oauth setup\` to provision a client, or set the `
    + `STORYBLOK_OAUTH_CLIENT_ID and STORYBLOK_OAUTH_CLIENT_SECRET environment variables.`,
  );
};
