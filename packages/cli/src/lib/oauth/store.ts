import type { RegionCode } from "../../constants";
import type { CredentialsFile } from "../../credentials-file";
import { readCredentialsFile, updateCredentialsFile } from "../../credentials-file";
import { isRegion } from "../../utils";

export interface OAuthClientCredentials {
  client_id: string;
  client_secret: string;
}

export interface OAuthTokens {
  auth_type: "oauth";
  access_token: string;
  refresh_token?: string;
  expires_at: string;
}

export interface OAuthGrantSpace {
  id: number;
  region: RegionCode | "unknown";
}

export interface OAuthRegionEntry {
  tokens?: OAuthTokens;
  spaces?: OAuthGrantSpace[];
}

// The `oauth` credentials section holds one entry per region, plus an
// `activeRegion` pointer marking the region the user most recently logged into.
// The pointer disambiguates which session to load when several regions are
// authenticated at once. Its key never collides with a region code.
type OAuthStore = Partial<Record<RegionCode, OAuthRegionEntry>> & { activeRegion?: RegionCode };

const getStore = (credentials: CredentialsFile): OAuthStore =>
  (credentials.oauth ?? {}) as OAuthStore;

export const readOAuthEntry = (
  credentials: CredentialsFile,
  region: RegionCode,
): OAuthRegionEntry => getStore(credentials)[region] ?? {};

/**
 * Applies a patch to one region's OAuth entry. Pure, so callers already holding the
 * credentials lock can compose it with their own read and write.
 */
export const applyOAuthEntry = (
  credentials: CredentialsFile,
  region: RegionCode,
  patch: OAuthRegionEntry & { activeRegion?: boolean },
): CredentialsFile => {
  const { activeRegion, ...entryPatch } = patch;
  const oauth = { ...getStore(credentials) };
  oauth[region] = { ...oauth[region], ...entryPatch };
  if (activeRegion) {
    oauth.activeRegion = region;
  }
  return { ...credentials, oauth };
};

export const getOAuthEntry = async (region: RegionCode): Promise<OAuthRegionEntry> =>
  readOAuthEntry(await readCredentialsFile(), region);

// The region the user most recently logged into, or undefined when unset or
// pointing at a value that is not a valid region.
export const getOAuthActiveRegion = async (): Promise<RegionCode | undefined> => {
  const active = getStore(await readCredentialsFile()).activeRegion;
  return active && isRegion(active) ? active : undefined;
};

// True when any region holds an OAuth session, regardless of which region it is.
export const hasAnyOAuthSession = async (): Promise<boolean> => {
  const oauth = getStore(await readCredentialsFile());
  return Object.entries(oauth).some(
    ([key, entry]) =>
      key !== "activeRegion" &&
      Boolean((entry as OAuthRegionEntry | undefined)?.tokens?.access_token),
  );
};

export const getOAuthClientFromEnv = (): OAuthClientCredentials | null => {
  const clientId = process.env.STORYBLOK_OAUTH_CLIENT_ID;
  const clientSecret = process.env.STORYBLOK_OAUTH_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { client_id: clientId, client_secret: clientSecret };
  }
  return null;
};

/**
 * Updates one region's OAuth entry.
 * @param region - The region whose entry is patched.
 * @param patch - Fields to merge into the entry; `activeRegion` also repoints the
 * active-region marker, in the same write.
 */
export const updateOAuthEntry = async (
  region: RegionCode,
  patch: OAuthRegionEntry & { activeRegion?: boolean },
): Promise<void> => {
  await updateCredentialsFile((credentials) => applyOAuthEntry(credentials, region, patch));
};

// Clears the session (tokens and granted spaces) for one region.
export const clearOAuthTokens = async (region: RegionCode): Promise<void> => {
  await updateCredentialsFile((credentials) => {
    const oauth = { ...getStore(credentials) };
    delete oauth[region];
    // Drop the pointer when the region it references is logged out, so the next
    // session falls back to whatever other region still has tokens.
    if (oauth.activeRegion === region) {
      delete oauth.activeRegion;
    }
    return { ...credentials, oauth };
  });
};
