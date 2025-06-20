// session.ts
import { type RegionCode, regionsDomain } from './constants';
import { addCredentials, getCredentials } from './creds';

export interface SessionState {
  isLoggedIn: boolean;
  login?: string;
  password?: string;
  region?: RegionCode;
  envLogin?: boolean;
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
      return;
    }

    // If no environment variables, fall back to .storyblok/credentials.json
    const credentials = await getCredentials();
    if (credentials) {
      // Todo: evaluate this in future when we want to support multiple regions
      const creds = Object.values(credentials)[0];
      state.isLoggedIn = true;
      state.login = creds.login;
      state.password = creds.password;
      state.region = creds.region as RegionCode;
    }
    else {
      // No credentials found; set state to logged out
      state.isLoggedIn = false;
      state.login = undefined;
      state.password = undefined;
      state.region = undefined;
    }
    state.envLogin = false;
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
        machineName: regionsDomain[region] || 'api.storyblok.com',
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
  }

  return {
    state,
    initializeSession,
    updateSession,
    persistCredentials,
    logout,
  };
}

export function session() {
  if (!sessionInstance) {
    sessionInstance = createSession();
  }
  return sessionInstance;
}
