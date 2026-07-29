import { exchangeToken } from './token-endpoint';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const handlers = [
  http.post('https://mapi.storyblok.com/oauth/token', async () => {
    return HttpResponse.json({
      access_token: 'access-token-value',
      refresh_token: 'refresh-token-value',
      expires_in: 3600,
      scope: 'read write',
    });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('exchangeToken', () => {
  it('should resolve with the access token and expires_in on a valid response', async () => {
    const result = await exchangeToken('eu', { grant_type: 'authorization_code', code: 'abc' });
    expect(result.access_token).toBe('access-token-value');
    expect(typeof result.expires_in).toBe('number');
    expect(result.expires_in).toBe(3600);
  });

  it('should reject with a CommandError when the response is missing access_token', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/oauth/token', async () => {
        return HttpResponse.json({
          expires_in: 3600,
        });
      }),
    );

    await expect(exchangeToken('eu', { grant_type: 'authorization_code', code: 'abc' })).rejects.toThrow(
      /unexpected shape/,
    );
  });

  it('should reject with a CommandError including the error code on an error status', async () => {
    server.use(
      http.post('https://mapi.storyblok.com/oauth/token', async () => {
        return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 });
      }),
    );

    await expect(exchangeToken('eu', { grant_type: 'authorization_code', code: 'abc' })).rejects.toThrow(
      /invalid_grant/,
    );
  });
});
