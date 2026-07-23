import { type RegionCode, regionsDomain } from './constants';
import { addCredentials, getCredentials } from './creds';
import { clearOAuthTokens, getOAuthActiveRegion, getOAuthEntry } from './commands/oauth/store';

export interface SessionState {
  isLoggedIn: boolean;
  login?: string;
  password?: string;
  region?: RegionCode;
  envLogin?: boolean;
  authType?: 'pat' | 'oauth';
  oauthAccessToken?: string;
  oauthExpiresAt?: string;
  oauthSpaces?: { id: number; region: string }[];
}

let sessionInstance: ReturnType<typeof createSession> | null = null;

function createSession() {
  const state: SessionState = {
    isLoggedIn: false,
  };

  async function initializeSession() {
    // First, check for environment variables
    const envCredentials = getEnvCredentials();
    if (envCredentials) {
      state.isLoggedIn = true;
      state.login = envCredentials.login;
      state.password = envCredentials.password;
      state.region = envCredentials.region as RegionCode;
      state.envLogin = true;
      state.authType = 'pat';
      return;
    }

    // If no environment variables, fall back to .storyblok/credentials.json
    const credentials = await getCredentials();
    // The credentials file also stores an `oauth` top-level key; exclude it so it is
    // never mistaken for a PAT entry (it has no login/password/region fields).
    const patEntry = credentials
      ? Object.entries(credentials).find(([machineName]) => machineName !== 'oauth')?.[1]
      : undefined;
    if (patEntry) {
      state.isLoggedIn = true;
      state.login = patEntry.login;
      state.password = patEntry.password;
      state.region = patEntry.region as RegionCode;
      state.authType = 'pat';
    }
    else {
      // No PAT credentials; try an OAuth session.
      const oauthLoaded = await loadOAuthSession();
      if (!oauthLoaded) {
        state.isLoggedIn = false;
        state.login = undefined;
        state.password = undefined;
        state.region = undefined;
        state.authType = undefined;
      }
    }
    state.envLogin = false;
  }

  async function loadOAuthSession(): Promise<boolean> {
    // Resolve the most recently used region first via the stored `activeRegion`
    // pointer, then fall back to a fixed order for its siblings. The fallback
    // also covers sessions created before the pointer existed and cases where
    // the pointer is stale (its region has no tokens). A command's explicit
    // `--region` still overrides whatever this resolves.
    const fixedOrder: RegionCode[] = ['eu', 'us', 'cn', 'ca', 'ap'];
    const activeRegion = await getOAuthActiveRegion();
    const regionsToCheck = activeRegion
      ? [activeRegion, ...fixedOrder.filter(region => region !== activeRegion)]
      : fixedOrder;
    for (const region of regionsToCheck) {
      const entry = await getOAuthEntry(region);
      if (entry.tokens?.access_token) {
        state.isLoggedIn = true;
        state.authType = 'oauth';
        state.region = region;
        state.oauthAccessToken = entry.tokens.access_token;
        state.oauthExpiresAt = entry.tokens.expires_at;
        state.oauthSpaces = entry.spaces;
        return true;
      }
    }
    return false;
  }

  async function clearOAuthSession(region: RegionCode): Promise<void> {
    await clearOAuthTokens(region);
    state.oauthAccessToken = undefined;
    state.oauthExpiresAt = undefined;
    state.oauthSpaces = undefined;
    if (state.authType === 'oauth') {
      logout();
    }
  }

  function getEnvCredentials() {
    const envLogin = process.env.STORYBLOK_LOGIN || process.env.TRAVIS_STORYBLOK_LOGIN;
    const envPassword = process.env.STORYBLOK_TOKEN || process.env.TRAVIS_STORYBLOK_TOKEN;
    const envRegion = process.env.STORYBLOK_REGION || process.env.TRAVIS_STORYBLOK_REGION;

    if (envLogin && envPassword && envRegion) {
      return {
        login: envLogin,
        password: envPassword,
        region: envRegion,
      };
    }
    return null;
  }

  async function persistCredentials(region: RegionCode) {
    if (state.isLoggedIn && state.login && state.password && state.region) {
      await addCredentials({
        machineName: regionsDomain[region] || 'mapi.storyblok.com',
        login: state.login,
        password: state.password,
        region: state.region,
      });
    }
    else {
      throw new Error('No credentials to save.');
    }
  }

  function updateSession(login: string, password: string, region: RegionCode) {
    state.isLoggedIn = true;
    state.login = login;
    state.password = password;
    state.region = region;
  }

  function logout() {
    state.isLoggedIn = false;
    state.login = undefined;
    state.password = undefined;
    state.region = undefined;
    state.authType = undefined;
  }

  return {
    state,
    initializeSession,
    updateSession,
    persistCredentials,
    logout,
    clearOAuthSession,
  };
}

export function session() {
  if (!sessionInstance) {
    sessionInstance = createSession();
  }
  return sessionInstance;
}
