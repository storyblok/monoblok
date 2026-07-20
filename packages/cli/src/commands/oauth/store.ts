import { join } from 'pathe';
import type { RegionCode } from '../../constants';
import { getCredentials } from '../../creds';
import { getStoryblokGlobalPath, saveToFile } from '../../utils/filesystem';

export interface OauthClientCredentials {
  client_id: string;
  client_secret: string;
  // Allowed scopes captured at setup time (PAT path); used as the default login scope set.
  scopes?: string[];
}

export interface OauthTokens {
  auth_type: 'oauth';
  access_token: string;
  refresh_token?: string;
  expires_at: string;
}

export interface OauthGrantSpace {
  id: number;
  region: RegionCode | 'unknown';
}

export interface OauthRegionEntry {
  client?: OauthClientCredentials;
  tokens?: OauthTokens;
  spaces?: OauthGrantSpace[];
}

const credentialsPath = (): string => join(getStoryblokGlobalPath(), 'credentials.json');

const readAll = async (): Promise<Record<string, unknown>> => {
  return (await getCredentials(credentialsPath()) as Record<string, unknown> | null) ?? {};
};

export const getOauthEntry = async (region: RegionCode): Promise<OauthRegionEntry> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as Record<string, OauthRegionEntry>;
  return oauth[region] ?? {};
};

export const getOauthClientFromEnv = (): OauthClientCredentials | null => {
  const clientId = process.env.STORYBLOK_OAUTH_CLIENT_ID;
  const clientSecret = process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { client_id: clientId, client_secret: clientSecret };
  }
  return null;
};

export const updateOauthEntry = async (region: RegionCode, patch: OauthRegionEntry): Promise<void> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as Record<string, OauthRegionEntry>;
  oauth[region] = { ...oauth[region], ...patch };
  await saveToFile(credentialsPath(), JSON.stringify({ ...all, oauth }, null, 2), { mode: 0o600 });
};

export const clearOauthEntry = async (region: RegionCode): Promise<void> => {
  const all = await readAll();
  const oauth = (all.oauth ?? {}) as Record<string, OauthRegionEntry>;
  delete oauth[region];
  await saveToFile(credentialsPath(), JSON.stringify({ ...all, oauth }, null, 2), { mode: 0o600 });
};
