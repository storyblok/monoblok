import { vol } from 'memfs';
import { beforeEach, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { session } from './session';
import { getStoryblokGlobalPath } from './utils/filesystem';

describe('session', () => {
  describe('session initialization with json', () => {
    it('should initialize session with json credentials', async () => {
      vol.fromJSON(
        {
          [join(getStoryblokGlobalPath(), 'credentials.json')]: JSON.stringify({
            'mapi.storyblok.com': {
              login: 'test_login',
              password: 'test_token',
              region: 'eu',
            },
          }),
        },
      );

      const userSession = session();
      await userSession.initializeSession();
      expect(userSession.state.isLoggedIn).toBe(true);
      expect(userSession.state.login).toBe('test_login');
      expect(userSession.state.password).toBe('test_token');
      expect(userSession.state.region).toBe('eu');
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
      process.env.STORYBLOK_REGION = 'eu';

      const userSession = session();
      await userSession.initializeSession();
      expect(userSession.state.isLoggedIn).toBe(true);
      expect(userSession.state.login).toBe('test_login');
      expect(userSession.state.password).toBe('test_token');
      expect(userSession.state.region).toBe('eu');
    });

    it('should initialize session from TRAVIS_STORYBLOK_ environment variables', async () => {
      process.env.TRAVIS_STORYBLOK_LOGIN = 'test_login';
      process.env.TRAVIS_STORYBLOK_TOKEN = 'test_token';
      process.env.TRAVIS_STORYBLOK_REGION = 'eu';

      const userSession = session();
      await userSession.initializeSession();
      expect(userSession.state.isLoggedIn).toBe(true);
      expect(userSession.state.login).toBe('test_login');
      expect(userSession.state.password).toBe('test_token');
      expect(userSession.state.region).toBe('eu');
    });
  });
});
