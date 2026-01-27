import { beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import type { RegionCode } from '../src/constants';
import type { SessionState } from '../src/session';

vi.mock('node:fs');
vi.mock('node:fs/promises');

export const loggedOutSessionState = (): SessionState => ({
  isLoggedIn: false,
});
export const loggedInSessionState = (): SessionState => ({
  isLoggedIn: true,
  password: 'valid-token',
  region: 'eu',
  envLogin: false,
});
const sessionApi = {
  state: loggedInSessionState(),
  initializeSession: vi.fn(() => {
    sessionApi.state = loggedInSessionState();
  }),
  updateSession: vi.fn((login: string, password: string, region: RegionCode) => {
    sessionApi.state.isLoggedIn = true;
    sessionApi.state.login = login;
    sessionApi.state.password = password;
    sessionApi.state.region = region;
  }),
  persistCredentials: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../src/session.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/session')>();
  return {
    ...actual,
    session: () => sessionApi,
  };
});

vi.mock('../src/lib/config/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/config/store')>();
  return {
    ...actual,
    setActiveConfig: (config: import('../src/lib/config/types').ResolvedCliConfig) =>
      actual.setActiveConfig({ ...config, api: { ...config.api, maxConcurrency: -1 } }),
  };
});

beforeEach(() => {
  vol.reset();
});
