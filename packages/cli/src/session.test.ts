// session.test.ts
import { session } from './session';

import { getCredentials } from './creds';
import type { Mock } from 'vitest';

vi.mock('./creds', () => ({
  getCredentials: vi.fn(),
}));

const mockedGetCredentials = getCredentials as Mock;

describe('session', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });
  describe('session initialization with json', () => {
    it('should initialize session with json credentials', async () => {
      mockedGetCredentials.mockReturnValue({
        'api.storyblok.com': {
          login: 'test_login',
          password: 'test_token',
          region: 'test_region',
        },
      });
      const userSession = session();
      await userSession.initializeSession();
      expect(userSession.state.isLoggedIn).toBe(true);
      expect(userSession.state.login).toBe('test_login');
      expect(userSession.state.password).toBe('test_token');
      expect(userSession.state.region).toBe('test_region');
    });
  });
  describe('session initialization with environment variables', () => {
    beforeEach(() => {
    // Clear environment variables before each test
      delete process.env.STORYBLOK_LOGIN;
      delete process.env.STORYBLOK_TOKEN;
      delete process.env.STORYBLOK_REGION;
      delete process.env.TRAVIS_STORYBLOK_LOGIN;
      delete process.env.TRAVIS_STORYBLOK_TOKEN;
      delete process.env.TRAVIS_STORYBLOK_REGION;
    });

    it('should initialize session from STORYBLOK_ environment variables', async () => {
      process.env.STORYBLOK_LOGIN = 'test_login';
      process.env.STORYBLOK_TOKEN = 'test_token';
      process.env.STORYBLOK_REGION = 'test_region';

      const userSession = session();
      await userSession.initializeSession();
      expect(userSession.state.isLoggedIn).toBe(true);
      expect(userSession.state.login).toBe('test_login');
      expect(userSession.state.password).toBe('test_token');
      expect(userSession.state.region).toBe('test_region');
    });

    it('should initialize session from TRAVIS_STORYBLOK_ environment variables', async () => {
      process.env.TRAVIS_STORYBLOK_LOGIN = 'test_login';
      process.env.TRAVIS_STORYBLOK_TOKEN = 'test_token';
      process.env.TRAVIS_STORYBLOK_REGION = 'test_region';

      const userSession = session();
      await userSession.initializeSession();
      expect(userSession.state.isLoggedIn).toBe(true);
      expect(userSession.state.login).toBe('test_login');
      expect(userSession.state.password).toBe('test_token');
      expect(userSession.state.region).toBe('test_region');
    });
  });
});
