import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLanguages, saveLanguagesToFile } from './actions';
import { mapiClient } from '../../api';

const handlers = [
  http.get('https://mapi.storyblok.com/v1/spaces/12345', async ({ request }) => {
    const token = request.headers.get('Authorization');
    if (token === 'valid-token') {
      return HttpResponse.json({
        space: {
          default_lang_name: 'en',
          languages: [
            {
              code: 'ca',
              name: 'Catalan',
            },
            {
              code: 'fr',
              name: 'French',
            },
          ],
        },
      });
    }
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('pull languages actions', () => {
  beforeEach(() => {
    mapiClient({
      token: {
        accessToken: 'valid-token',
      },
      region: 'eu',
    });
    vi.clearAllMocks();
  });

  describe('fetchLanguages', () => {
    it('should pull languages successfully with a valid token', async () => {
      const mockResponse = {
        default_lang_name: 'en',
        languages: [
          {
            code: 'ca',
            name: 'Catalan',
          },
          {
            code: 'fr',
            name: 'French',
          },
        ],
      };
      const result = await fetchLanguages('12345');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('saveLanguagesToFile', () => {
    it('should save a consolidated languages file', async () => {
      const mockResponse = {
        default_lang_name: 'en',
        languages: [
          {
            code: 'ca',
            name: 'Catalan',
          },
          {
            code: 'fr',
            name: 'French',
          },
        ],
      };
      await saveLanguagesToFile('12345', mockResponse, {
        filename: 'languages',
        path: '/temp',
        verbose: false,
        space: '12345',
      });
      const content = vol.readFileSync('/temp/languages/12345/languages.json', 'utf8');
      expect(content).toBe(JSON.stringify(mockResponse, null, 2));
    });
  });
});
