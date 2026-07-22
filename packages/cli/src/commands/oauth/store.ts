import { join } from 'pathe';
import type { RegionCode } from '../../constants';
import { getCredentials } from '../../creds';
import { getStoryblokGlobalPath, saveToFile } from '../../utils/filesystem';

export interface OAuthClientCredentials {
  client_id: string;
  client_secret: string;
  // Allowed scopes captured at setup time (PAT path); used as the default login scope set.
  scopes?: string[];
}

export interface OAuthTokens {
  auth_type: 'oauth';
  access_token: string;
  refresh_token?: string;
  expires_at: string;
}

export interface OAuthGrantSpace {
  id: number;
  region: RegionCode | 'unknown';
}

export interface OAuthRegionEntry {
  client?: OAuthClientCredentials;
  tokens?: OAuthTokens;
  spaces?: OAuthGrantSpace[];
}

const credentialsPath = (): string => join(getStoryblokGlobalPath(), 'credentials.json');

const readAll = async (): Promise<Record<string, unknown>> => {
  return (await getCredentials(credentialsPath()) as Record<string, unknown> | null) ?? {};
};

export const getOAuthEntry = async (region: RegionCode): Promise<OAuthRegionEntry> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as Record<string, OAuthRegionEntry>;
  return oauth[region] ?? {};
};

export const getOAuthClientFromEnv = (): OAuthClientCredentials | null => {
  const clientId = process.env.STORYBLOK_OAUTH_CLIENT_ID;
  const clientSecret = process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { client_id: clientId, client_secret: clientSecret };
  }
  return null;
};

export const updateOAuthEntry = async (region: RegionCode, patch: OAuthRegionEntry): Promise<void> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as Record<string, OAuthRegionEntry>;
  oauth[region] = { ...oauth[region], ...patch };
  await saveToFile(credentialsPath(), JSON.stringify({ ...all, oauth }, null, 2), { mode: 0o600 });
};

// Clears the session (tokens and granted spaces) while preserving the provisioned client
// credentials, so logout does not force users to re-run `oauth setup` before the next login.
export const clearOAuthTokens = async (region: RegionCode): Promise<void> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as Record<string, OAuthRegionEntry>;
  const entry = oauth[region];
  if (!entry) {
    return;
  }
  if (entry.client) {
    oauth[region] = { client: entry.client };
  }
  else {
    delete oauth[region];
  }
  await saveToFile(credentialsPath(), JSON.stringify({ ...all, oauth }, null, 2), { mode: 0o600 });
};
