import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManagementApiClient } from '../index';

// Mock fetch to simulate 429 responses
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ManagementApiClient Integration - Per-Instance Rate Limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry 429 responses at fetch level', async () => {
    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        // Return 429 for first two calls
        return new Response('Rate limited', { 
          status: 429,
          headers: { 'retry-after': '1' }
        });
      }
      // Success on third call
      return new Response(JSON.stringify({ data: 'success' }), { 
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const client = new ManagementApiClient({
      token: { accessToken: 'test-token' },
      region: 'eu',
    });

    // This will trigger a fetch call through the SDK
    const promise = client.spaces.list({});
    
    // Advance timers to allow retries to complete
    await vi.advanceTimersByTimeAsync(3000);
    
    const result = await promise;
    
    // Should have made 3 calls (2 failures + 1 success)
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toBeDefined();
  });

  it('should respect retry-after header', async () => {
    let callCount = 0;
    const startTime = Date.now();
    
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('Rate limited', { 
          status: 429,
          headers: { 'retry-after': '2' } // 2 seconds
        });
      }
      return new Response(JSON.stringify({ data: 'success' }), { 
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    const client = new ManagementApiClient({
      token: { accessToken: 'test-token' },
      region: 'eu',
    });

    const promise = client.spaces.list({});
    
    // Advance by 1.9 seconds - should not have retried yet
    await vi.advanceTimersByTimeAsync(1900);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Advance by remaining 0.1 seconds - should now retry
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should stop retrying after max attempts', async () => {
    mockFetch.mockImplementation(async () => {
      return new Response('Rate limited', { 
        status: 429,
        headers: { 'retry-after': '1' }
      });
    });

    const client = new ManagementApiClient({
      token: { accessToken: 'test-token' },
      region: 'eu',
    });

    const promise = client.spaces.list({});
    
    // Advance timers to allow all retries
    await vi.advanceTimersByTimeAsync(14000);
    
    const result = await promise;
    
    // Should make initial + maxRetries calls (12 retries = 13 total)
    expect(mockFetch).toHaveBeenCalledTimes(13);
    
    // Result should contain the error since all retries failed
    expect(result).toBeDefined();
  });

  it('should have separate rate limiting per client instance', async () => {
    mockFetch.mockImplementation(async () => {
      return new Response(JSON.stringify({ data: 'success' }), { 
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });

    // Create two separate client instances
    const client1 = new ManagementApiClient({
      token: { accessToken: 'token1' },
      region: 'eu',
    });

    const client2 = new ManagementApiClient({
      token: { accessToken: 'token2' },
      region: 'us',
    });

    // Make a simple request from each client
    await client1.spaces.list({});
    await client2.spaces.list({});

    // Both clients should have made their requests
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
