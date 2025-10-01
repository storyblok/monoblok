// session.ts
import { type RegionCode, regionsDomain } from './constants';
import { addCredentials, getCredentials, isEnvLogin } from './creds';

export interface SessionState {
  isLoggedIn: boolean;
  login?: string;
  password?: string;
  region?: RegionCode;
  baseUrl?: string;
  envLogin: boolean;
}

let sessionInstance: ReturnType<typeof createSession> | null = null;

function createSession() {
  const state: SessionState = {
    isLoggedIn: false,
    envLogin: false,
  };

  async function initializeSession() {
    const credentials = await getCredentials();
    state.isLoggedIn = Boolean(credentials);
    state.envLogin = isEnvLogin();
    state.login = credentials?.login;
    state.password = credentials?.password;
    state.region = credentials?.region;
    state.baseUrl = credentials?.baseUrl;
  }

  async function persistCredentials(region: RegionCode) {
    if (state.isLoggedIn && state.login && state.password && state.region) {
      await addCredentials({
        machineName: regionsDomain[region],
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
