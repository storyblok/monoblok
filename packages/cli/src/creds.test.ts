import { addCredentials, getCredentials, removeAllCredentials, removePatCredentials } from './creds';
import { describe, expect, it } from 'vitest';
import { vol } from 'memfs';
import type { StoryblokCredentials } from './types';

describe('creds', async () => {
  describe('getCredentials', () => {
    it('should return the parsed content of credentials.json file', async () => {
      vol.fromJSON({
        'test/credentials.json': JSON.stringify({
          'api.storyblok.com': {
            login: 'julio.professional@storyblok.com',
            password: 'my_access_token',
            region: 'eu',
          },
        }),
      }, '/temp');

      const credentials = await getCredentials('/temp/test/credentials.json') as StoryblokCredentials;

      expect(credentials['api.storyblok.com']).toEqual({
        login: 'julio.professional@storyblok.com',
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
        login: 'julio.professional@storyblok.com',
        password: 'my_access_token',
        region: 'eu',
      });

      const content = vol.readFileSync('/temp/test/credentials.json', 'utf8');
      expect(content).toBe('{\n  "api.storyblok.com": {\n    "login": "julio.professional@storyblok.com",\n    "password": "my_access_token",\n    "region": "eu"\n  }\n}');
    });
  });

  describe('removeAllCredentials', () => {
    it('should remove an entry from credentials file', async () => {
      vol.fromJSON({
        'test/credentials.json': JSON.stringify({
          'api.storyblok.com': {
            login: 'julio.professional@storyblok.com',
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

  describe('removePatCredentials', () => {
    it('should remove PAT entries while preserving the oauth section', async () => {
      vol.fromJSON({
        'test/credentials.json': JSON.stringify({
          'api.storyblok.com': {
            login: 'julio.professional@storyblok.com',
            password: 'my_access_token',
            region: 'eu',
          },
          'oauth': {
            eu: { client: { client_id: 'abc', client_secret: 'shh' } },
            activeRegion: 'eu',
          },
        }),
      }, '/temp');

      await removePatCredentials('/temp/test');

      const content = JSON.parse(vol.readFileSync('/temp/test/credentials.json', 'utf8') as string);
      expect(content['api.storyblok.com']).toBeUndefined();
      expect(content.oauth).toEqual({
        eu: { client: { client_id: 'abc', client_secret: 'shh' } },
        activeRegion: 'eu',
      });
    });

    it('should write an empty object when there is no oauth section', async () => {
      vol.fromJSON({
        'test/credentials.json': JSON.stringify({
          'api.storyblok.com': {
            login: 'julio.professional@storyblok.com',
            password: 'my_access_token',
            region: 'eu',
          },
        }),
      }, '/temp');

      await removePatCredentials('/temp/test');

      const content = vol.readFileSync('/temp/test/credentials.json', 'utf8');
      expect(content).toBe('{}');
    });
  });
});
