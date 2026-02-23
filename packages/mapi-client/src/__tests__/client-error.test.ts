import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClientError } from '../client/error';
import { ManagementApiClient } from '../index';

describe('ClientError', () => {
  it('should set all properties correctly', () => {
    const error = new ClientError('Not Found', {
      status: 404,
      statusText: 'Not Found',
      data: { message: 'Story not found' },
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ClientError);
    expect(error.name).toBe('ClientError');
    expect(error.message).toBe('Not Found');
    expect(error.status).toBe(404);
    expect(error.statusText).toBe('Not Found');
    expect(error.data).toEqual({ message: 'Story not found' });
    expect(error.response).toEqual({
      status: 404,
      statusText: 'Not Found',
      data: { message: 'Story not found' },
    });
  });

  it('should handle string data (e.g. "Unauthorized")', () => {
    const error = new ClientError('Unauthorized', {
      status: 401,
      statusText: 'Unauthorized',
      data: 'Unauthorized',
    });

    expect(error.status).toBe(401);
    expect(error.data).toBe('Unauthorized');
    expect(error.response.data).toBe('Unauthorized');
  });

  it('should handle empty object data', () => {
    const error = new ClientError('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error',
      data: {},
    });

    expect(error.status).toBe(500);
    expect(error.data).toEqual({});
  });
});

describe('Client throws ClientError on error responses', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throw ClientError with correct metadata on 401', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify('Unauthorized'), {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = new ManagementApiClient({
      token: { accessToken: 'bad-token' },
      region: 'eu',
      throwOnError: true,
    });

    try {
      // Use a simple API call
      await client.users.me({ fetch: mockFetch });
      expect.fail('Should have thrown');
    }
    catch (error) {
      expect(error).toBeInstanceOf(ClientError);
      const clientError = error as ClientError;
      expect(clientError.status).toBe(401);
      expect(clientError.statusText).toBe('Unauthorized');
      expect(clientError.data).toBe('Unauthorized');
      expect(clientError.response.status).toBe(401);
    }
  });

  it('should throw ClientError with JSON error body on 422', async () => {
    const errorBody = { slug: ['has already been taken'] };
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify(errorBody), {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/json' },
      }),
    );

    const client = new ManagementApiClient({
      token: { accessToken: 'test-token' },
      region: 'eu',
      throwOnError: true,
    });

    try {
      await client.users.me({ fetch: mockFetch });
      expect.fail('Should have thrown');
    }
    catch (error) {
      expect(error).toBeInstanceOf(ClientError);
      const clientError = error as ClientError;
      expect(clientError.status).toBe(422);
      expect(clientError.data).toEqual(errorBody);
    }
  });
});
