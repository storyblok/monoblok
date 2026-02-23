import { afterAll, afterEach, beforeAll, expect } from 'vitest';

import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { loginWithEmailAndPassword, loginWithOtp, loginWithToken } from './actions';
import chalk from 'chalk';

const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/;

const handlers = [
  http.get('https://mapi.storyblok.com/v1/users/me', async ({ request }) => {
    const token = request.headers.get('Authorization');
    if (token === 'valid-token') {
      return HttpResponse.json({
        user: { id: 1, email: 'test@example.com', friendly_name: 'Test User' },
      });
    }
    return new HttpResponse('Unauthorized', { status: 401 });
  }),
  http.post('https://mapi.storyblok.com/v1/users/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    if (!emailRegex.test(body.email)) {
      return new HttpResponse('Unprocessable Entity', { status: 422 });
    }

    if (body?.email === 'julio.professional@storyblok.com' && body?.password === 'password') {
      return HttpResponse.json({ otp_required: true });
    }
    else {
      return new HttpResponse('Unauthorized', { status: 401 });
    }
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('login actions', () => {
  describe('loginWithToken', () => {
    it('should login successfully with a valid token', async () => {
      const mockResponse = { id: 1, email: 'test@example.com', friendly_name: 'Test User' };
      const result = await loginWithToken('valid-token', 'eu');
      expect(result).toEqual(mockResponse);
    });

    it('should throw an masked error for invalid token', async () => {
      await expect(loginWithToken('invalid-token', 'eu')).rejects.toThrow(
        `The token provided ${chalk.bold('inva*********')} is invalid.
        Please make sure you are using the correct token and try again.`,
      );
    });

    it('should throw a server error if response is 500', async () => {
      server.use(
        http.get('https://mapi.storyblok.com/v1/users/me', () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      await expect(loginWithToken('any-token', 'eu')).rejects.toThrow(
        'The server returned an error',
      );
    });
  });

  describe('loginWithEmailAndPassword', () => {
    it('should get if the user requires otp', async () => {
      const expected = { otp_required: true, perPage: 0, total: 0 };
      const result = await loginWithEmailAndPassword('julio.professional@storyblok.com', 'password', 'eu');
      expect(result).toEqual(expected);
    });

    it('should throw an error for invalid credentials', async () => {
      await expect(loginWithEmailAndPassword('david.bisbal@storyblok.com', 'password', 'eu')).rejects.toThrow(
        'The provided credentials are invalid',
      );
    });
  });

  describe('loginWithOtp', () => {
    it('should login successfully with valid email, password, and otp', async () => {
      server.use(
        http.post('https://mapi.storyblok.com/v1/users/login', async ({ request }) => {
          const body = await request.json() as { email: string; password: string; otp_attempt: string };
          if (body?.email === 'julio.professional@storyblok.com' && body?.password === 'password' && body?.otp_attempt === '123456') {
            return HttpResponse.json({ access_token: 'Awiwi' });
          }

          else {
            return new HttpResponse('Unauthorized', { status: 401 });
          }
        }),
      );
      const expected = { access_token: 'Awiwi', perPage: 0, total: 0 };

      const result = await loginWithOtp('julio.professional@storyblok.com', 'password', '123456', 'eu');

      expect(result).toEqual(expected);
    });
  });
});
