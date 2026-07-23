import { join } from 'pathe';
import type { RegionCode } from '../../constants';
import { getCredentials } from '../../creds';
import { isRegion } from '../../utils';
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

// The `oauth` credentials section holds one entry per region, plus an
// `activeRegion` pointer marking the region the user most recently logged into.
// The pointer disambiguates which session to load when several regions are
// authenticated at once. Its key never collides with a region code.
type OAuthStore = Partial<Record<RegionCode, OAuthRegionEntry>> & { activeRegion?: RegionCode };

const credentialsPath = (): string => join(getStoryblokGlobalPath(), 'credentials.json');

const readAll = async (): Promise<Record<string, unknown>> => {
  return (await getCredentials(credentialsPath()) as Record<string, unknown> | null) ?? {};
};

export const getOAuthEntry = async (region: RegionCode): Promise<OAuthRegionEntry> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as OAuthStore;
  return oauth[region] ?? {};
};

// The region the user most recently logged into, or undefined when unset or
// pointing at a value that is not a valid region.
export const getOAuthActiveRegion = async (): Promise<RegionCode | undefined> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as OAuthStore;
  const active = oauth.activeRegion;
  return active && isRegion(active) ? active : undefined;
};

export const setOAuthActiveRegion = async (region: RegionCode): Promise<void> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as OAuthStore;
  oauth.activeRegion = region;
  await saveToFile(credentialsPath(), JSON.stringify({ ...all, oauth }, null, 2), { mode: 0o600 });
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
  const oauth = (all.oauth ?? {}) as OAuthStore;
  oauth[region] = { ...oauth[region], ...patch };
  await saveToFile(credentialsPath(), JSON.stringify({ ...all, oauth }, null, 2), { mode: 0o600 });
};

// Clears the session (tokens and granted spaces) while preserving the provisioned client
// credentials, so logout does not force users to re-run `oauth setup` before the next login.
export const clearOAuthTokens = async (region: RegionCode): Promise<void> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as OAuthStore;
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
  // Drop the pointer when the region it references is logged out, so the next
  // session falls back to whatever other region still has tokens.
  if (oauth.activeRegion === region) {
    delete oauth.activeRegion;
  }
  await saveToFile(credentialsPath(), JSON.stringify({ ...all, oauth }, null, 2), { mode: 0o600 });
};
