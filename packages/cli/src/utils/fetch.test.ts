import { describe, expect, it, vi } from 'vitest';
import { customFetch, FetchError } from './fetch';

// Mock fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('customFetch', () => {
  it('should make a successful GET request', async () => {
    const mockResponse = { data: 'test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'content-type': 'application/json',
        'per-page': '10',
        'total': '100',
      }),
      json: () => Promise.resolve(mockResponse),
    });

    const result = await customFetch('https://api.test.com');
    expect(result).toEqual({
      ...mockResponse,
      perPage: 10,
      total: 100,
    });
  });

  it('should handle object body by stringifying it', async () => {
    const body = { test: 'data' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'content-type': 'application/json',
        'per-page': '10',
        'total': '100',
      }),
      json: () => Promise.resolve({}),
    });

    await customFetch('https://api.test.com', { body });

    expect(mockFetch).toHaveBeenCalledWith('https://api.test.com', expect.objectContaining({
      body: JSON.stringify(body),
    }));
  });

  it('should pass string body as-is without modification', async () => {
    const body = '{"test":"data"}';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'content-type': 'application/json',
        'per-page': '10',
        'total': '100',
      }),
      json: () => Promise.resolve({}),
    });

    await customFetch('https://api.test.com', { body });

    expect(mockFetch).toHaveBeenCalledWith('https://api.test.com', expect.objectContaining({
      body,
    }));
  });

  it('should handle array body by stringifying it', async () => {
    const body = ['test', 'data'];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'content-type': 'application/json',
        'per-page': '10',
        'total': '100',
      }),
      json: () => Promise.resolve({}),
    });

    await customFetch('https://api.test.com', { body });

    expect(mockFetch).toHaveBeenCalledWith('https://api.test.com', expect.objectContaining({
      body: JSON.stringify(body),
    }));
  });

  it('should handle non-JSON responses', async () => {
    const textResponse = 'Hello World';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'content-type': 'text/plain',
        'per-page': '10',
        'total': '100',
      }),
      text: () => Promise.resolve(textResponse),
    });

    await expect(customFetch('https://api.test.com')).rejects.toThrow(FetchError);
  });

  it('should throw FetchError for HTTP errors', async () => {
    const errorResponse = { message: 'Not Found' };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({
        'content-type': 'application/json',
        'per-page': '10',
        'total': '100',
      }),
      json: () => Promise.resolve(errorResponse),
    });

    await expect(customFetch('https://api.test.com')).rejects.toThrow(FetchError);
    await expect(customFetch('https://api.test.com')).rejects.toMatchObject({
      response: {
        status: 404,
        statusText: 'Not Found',
        data: errorResponse,
      },
    });
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'));

    await expect(customFetch('https://api.test.com')).rejects.toThrow(FetchError);
    await expect(customFetch('https://api.test.com')).rejects.toMatchObject({
      response: {
        status: 0,
        statusText: 'Network Error',
        data: null,
      },
    });
  });

  it('should set correct headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'content-type': 'application/json',
        'per-page': '10',
        'total': '100',
      }),
      json: () => Promise.resolve({}),
    });

    await customFetch('https://api.test.com', {
      headers: {
        Authorization: 'Bearer token',
      },
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.test.com', expect.objectContaining({
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
      }),
    }));
  });
});
