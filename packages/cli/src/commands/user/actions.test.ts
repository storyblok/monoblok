import { getUser } from './actions';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = [
  http.get('https://mapi.storyblok.com/v1/users/me', async ({ request }) => {
    const token = request.headers.get('Authorization');
    if (token === 'valid-token') {
      return HttpResponse.json({
        user: { data: 'user data', name: 'John Doe', friendly_name: 'Johnny' },
      });
    }
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('user actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUser', () => {
    it('should get user successfully with a valid token', async () => {
      const mockResponse = { data: 'user data', name: 'John Doe', friendly_name: 'Johnny' };
      const result = await getUser('valid-token', 'eu');
      expect(result).toEqual(mockResponse);
    });
  });

  it('should throw an masked error for invalid token', async () => {
    await expect(getUser('invalid-token', 'eu')).rejects.toThrow(
      `The token provided inva********* is invalid.
        Please make sure you are using the correct token and try again.`,
    );
  });

  it('should throw a server error if response is 500', async () => {
    server.use(
      http.get('https://mapi.storyblok.com/v1/users/me', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );
    await expect(getUser('any-token', 'eu')).rejects.toThrow(
      'The server returned an error',
    );
  });
});
