import { addCredentials, getCredentials, removeAllCredentials } from './creds';
import { vol } from 'memfs';
import type { StoryblokCredentials } from './types';
// tell vitest to use fs mock from __mocks__ folder
// this can be done in a setup file if fs should always be mocked
vi.mock('node:fs');
vi.mock('node:fs/promises');

beforeEach(() => {
  // reset the state of in-memory fs
  vol.reset();
});

describe('creds', async () => {
  describe('getCredentials', () => {
    it('should return the parsed content of credentials.json file', async () => {
      vol.fromJSON({
        'test/credentials.json': JSON.stringify({
          'api.storyblok.com': {
            login: 'julio.iglesias@storyblok.com',
            password: 'my_access_token',
            region: 'eu',
          },
        }),
      }, '/temp');

      const credentials = await getCredentials('/temp/test/credentials.json') as StoryblokCredentials;

      expect(credentials['api.storyblok.com']).toEqual({
        login: 'julio.iglesias@storyblok.com',
        password: 'my_access_token',
        region: 'eu',
      });
    });
    it('should create a credentials.json file if it does not exist', async () => {
      const credentials = await getCredentials('/temp/test/nonexistent.json');
      expect(credentials).toEqual(null);
    });
  });

  describe('addCredentials', () => {
    it('should add a new entry to an empty credentials file', async () => {
      vol.fromJSON({
        'test/credentials.json': '{}',
      }, '/temp');

      await addCredentials({
        filePath: '/temp/test/credentials.json',
        machineName: 'api.storyblok.com',
        login: 'julio.iglesias@storyblok.com',
        password: 'my_access_token',
        region: 'eu',
      });

      const content = vol.readFileSync('/temp/test/credentials.json', 'utf8');
      expect(content).toBe('{\n  "api.storyblok.com": {\n    "login": "julio.iglesias@storyblok.com",\n    "password": "my_access_token",\n    "region": "eu"\n  }\n}');
    });
  });

  describe('removeAllCredentials', () => {
    it('should remove an entry from credentials file', async () => {
      vol.fromJSON({
        'test/credentials.json': JSON.stringify({
          'api.storyblok.com': {
            login: 'julio.iglesias@storyblok.com',
            password: 'my_access_token',
            region: 'eu',
          },
        }),
      }, '/temp');

      await removeAllCredentials('/temp/test');

      const content = vol.readFileSync('/temp/test/credentials.json', 'utf8');
      expect(content).toBe('{}');
    });
  });
});
