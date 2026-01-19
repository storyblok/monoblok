import { beforeEach, vi } from 'vitest';
import { vol } from 'memfs';
import type { RegionCode } from '../src/constants';
import type { SessionState } from '../src/session';

vi.mock('node:fs');
vi.mock('node:fs/promises');

const defaultSessionState: SessionState = {
  isLoggedIn: true,
  password: 'valid-token',
  region: 'eu',
  envLogin: false,
};
const sessionApi = {
  state: structuredClone(defaultSessionState),
  initializeSession: vi.fn(() => {
    sessionApi.state = structuredClone(defaultSessionState);
  }),
  updateSession: vi.fn((login: string, password: string, region: RegionCode) => {
    sessionApi.state.isLoggedIn = true;
    sessionApi.state.login = login;
    sessionApi.state.password = password;
    sessionApi.state.region = region;
  }),
  persistCredentials: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn(() => {
    sessionApi.state.isLoggedIn = false;
    sessionApi.state.login = undefined;
    sessionApi.state.password = undefined;
    sessionApi.state.region = undefined;
  }),
};

vi.mock('../src/session.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/session')>();
  return {
    ...actual,
    session: vi.fn(() => sessionApi),
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
  sessionApi.initializeSession();
});
