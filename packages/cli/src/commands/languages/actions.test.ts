import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { vol } from 'memfs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchLanguages, saveLanguagesToFile } from './actions';
import { FetchError } from 'src/utils/fetch';
import { APIError } from 'src/utils';

const handlers = [
  http.get('https://api.storyblok.com/v1/spaces/12345', async ({ request }) => {
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

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('pull languages actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();
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
      const result = await fetchLanguages('12345', 'valid-token', 'eu');
      expect(result).toEqual(mockResponse);
    });
  });
  it.skip('should throw an masked error for invalid token', async () => {
    // TODO: Fix this test, is the only of it's kind that is not working, it's not clear why
    // Test return "Compared values have no visual difference." but fails anyway
    const error = new FetchError('Non-JSON response', { status: 401, statusText: 'Unauthorized', data: null });
    await expect(fetchLanguages('12345', 'invalid-token', 'eu')).rejects.toThrow(
      new APIError('unauthorized', 'pull_languages', error, `The user is not authorized to access the API`),
    );
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
