import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ISbFetch } from './sbFetch';
import SbFetch from './sbFetch';
import { headersToObject } from '../tests/utils';

describe('sbFetch', () => {
  let sbFetch: SbFetch;
  const mockFetch = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize', () => {
    sbFetch = new SbFetch({} as ISbFetch);
    expect(sbFetch).toBeInstanceOf(SbFetch);
  });

  describe('get', () => {
    it('should correctly construct URLs for GET requests', async () => {
      sbFetch = new SbFetch({
        baseURL: 'https://api.storyblok.com/v2/',
        fetch: mockFetch,
      } as ISbFetch);
      const response = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      mockFetch.mockResolvedValue(response);
      await sbFetch.get('test', {
        is_startpage: false,
        search_term: 'test',
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.storyblok.com/v2/test?is_startpage=false&search_term=test',
        expect.anything(),
      );
    });
  });

  describe('post', () => {
    it('should handle POST requests correctly', async () => {
      const testPayload = { title: 'New Story' };
      const response = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      mockFetch.mockResolvedValue(response);
      await sbFetch.post('stories', testPayload);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.storyblok.com/v2/stories',
        {
          method: 'post',
          body: JSON.stringify(testPayload),
          headers: expect.any(Headers),
          signal: expect.any(AbortSignal),
        },
      );
    });

    it('should set specific headers for POST requests', async () => {
      sbFetch = new SbFetch({
        baseURL: 'https://api.storyblok.com/v2/',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
        fetch: mockFetch,
      } as ISbFetch);
      const testPayload = { title: 'New Story' };
      const response = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      mockFetch.mockResolvedValue(response);

      await sbFetch.post('stories', testPayload);

      // Get the last call to fetch and extract the headers
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      const actualHeaders = headersToObject(lastCall[1].headers);
      expect(actualHeaders['content-type']).toBe('application/json');
    });
  });

  describe('put', () => {
    it('should handle PUT requests correctly', async () => {
      const testPayload = { title: 'Updated Story' };
      const response = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      mockFetch.mockResolvedValue(response);
      await sbFetch.put('stories/1', testPayload);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.storyblok.com/v2/stories/1',
        {
          method: 'put',
          body: JSON.stringify(testPayload),
          headers: expect.any(Headers),
          signal: expect.any(AbortSignal),
        },
      );
    });
  });

  describe('delete', () => {
    it('should handle DELETE requests correctly', async () => {
      const response = new Response(null, {
        status: 204, // Typically, DELETE operations might not return content
      });
      mockFetch.mockResolvedValue(response);
      await sbFetch.delete('stories/1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.storyblok.com/v2/stories/1',
        {
          method: 'delete',
          body: '{}', // Ensuring no body is sent
          headers: expect.any(Headers),
          signal: expect.any(AbortSignal),
        },
      );
    });
  });

  it('should handle network errors gracefully', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network Failure'));
    const sbFetch = new SbFetch({
      baseURL: 'https://api.example.com',
      headers: new Headers(),
      fetch: mockFetch,
    });

    // Assuming your implementation wraps the error message inside an object under `message`.
    const result = await sbFetch.get('/test', {});

    // Check if the error object format matches your implementation.
    expect(result).toEqual({
      message: expect.any(String), // Checks if `message` is a string
    });

    // If you want to be more specific and check the message of the error:
    expect(result.message).toEqual('Network Failure'); // This path needs to match the structure you actually use.
  });

  describe('timeout behavior', () => {
    // Helper to create mock fetch with configurable delay
    const createMockFetch = (delayMs: number) => {
      return vi.fn((_url: string, options?: any): Promise<Response> => {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            resolve(new Response(JSON.stringify({ data: 'test' }), { status: 200 }));
          }, delayMs);

          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
        });
      });
    };

    // Helper to create SbFetch instance with timeout
    const createSbFetchWithTimeout = (timeoutSeconds: number, mockFetch: any) => {
      return new SbFetch({
        baseURL: 'https://api.storyblok.com/v2',
        timeout: timeoutSeconds,
        headers: new Headers(),
        fetch: mockFetch as any,
      });
    };

    it('should timeout after configured timeout period', async () => {
      const mockFetch = createMockFetch(5000);
      const sbFetch = createSbFetchWithTimeout(1, mockFetch);

      const result = await sbFetch.get('cdn/stories', {});
      expect(result).toEqual({
        message: 'Request timeout: The request was aborted due to timeout',
      });
    }, 3000);

    it('should timeout after 2 seconds when configured with 2s timeout', async () => {
      vi.useFakeTimers();

      const mockFetch = createMockFetch(5000);
      const sbFetch = createSbFetchWithTimeout(2, mockFetch);

      const requestPromise = sbFetch.get('cdn/stories', {});

      // After 1.9 seconds, request should still be pending
      await vi.advanceTimersByTimeAsync(1900);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // After 2+ seconds, should timeout
      await vi.advanceTimersByTimeAsync(200);
      const result = await requestPromise;
      expect(result).toEqual({
        message: 'Request timeout: The request was aborted due to timeout',
      });

      vi.useRealTimers();
    }, 3000);

    it('should timeout after 0.5 seconds when configured with 0.5s timeout', async () => {
      vi.useFakeTimers();

      const mockFetch = createMockFetch(5000);
      const sbFetch = createSbFetchWithTimeout(0.5, mockFetch);

      const requestPromise = sbFetch.get('cdn/stories', {});

      // After 0.5+ seconds, should timeout
      await vi.advanceTimersByTimeAsync(600);
      const result = await requestPromise;
      expect(result).toEqual({
        message: 'Request timeout: The request was aborted due to timeout',
      });

      vi.useRealTimers();
    }, 3000);

    it('should complete successfully if response arrives before timeout', async () => {
      const mockFetch = createMockFetch(500); // 500ms delay
      const sbFetch = createSbFetchWithTimeout(2, mockFetch);

      const result = await sbFetch.get('cdn/stories', {});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('status', 200);
    }, 3000);

    it('should not timeout when timeout is set to 0 (disabled)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 }),
      );
      const sbFetch = createSbFetchWithTimeout(0, mockFetch);

      const result = await sbFetch.get('cdn/stories', {});
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('status', 200);
    }, 3000);

    it('should return clear error message for timeout', async () => {
      const mockFetch = vi.fn((_url: string, options?: any): Promise<Response> => {
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => {
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
          // Immediately abort to test the error message
          setTimeout(() => options?.signal?.dispatchEvent(new Event('abort')), 10);
        });
      });

      const sbFetch = createSbFetchWithTimeout(1, mockFetch);

      const result = await sbFetch.get('cdn/stories', {});
      expect((result as any).message).toBe('Request timeout: The request was aborted due to timeout');
    });
  });
});
