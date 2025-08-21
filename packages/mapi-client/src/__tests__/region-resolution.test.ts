import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '../client';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Space ID Region Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation(async (request) => {
      return new Response(JSON.stringify({ data: 'success' }), { 
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
  });

  it('should resolve region from space_id and make fetch call to correct baseUrl', async () => {
    // Create client without baseUrl to trigger space_id region resolution
    const client = createClient({
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });

    // Make a request with space_id 123456 (actual region resolution will be applied)
    await client.get({
      url: '/v1/spaces/{space_id}/stories',
      path: { space_id: 564469716905585 }
    });

    // Verify fetch was called - the URL should be different from default EU region
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [requestArg] = mockFetch.mock.calls[0];
    // Space 123456 resolves to EU region (default), so it uses mapi.storyblok.com
    expect(requestArg.url).toBe('https://api-us.storyblok.com/v1/spaces/564469716905585/stories');
  });

  it('should not resolve region when baseUrl is already configured', async () => {
    // Create client with explicit baseUrl
    const client = createClient({
      baseUrl: 'https://custom-api.example.com',
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });

    await client.get({
      url: '/v1/spaces/{space_id}/stories',
      path: { space_id: 123456 }
    });

    // Should use the configured baseUrl
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [requestArg] = mockFetch.mock.calls[0];
    expect(requestArg.url).toBe('https://custom-api.example.com/v1/spaces/123456/stories');
  });

  it.each([
    { space_id: 845944693616241, expectedUrl: 'https://api-ca.storyblok.com/v1/spaces/845944693616241/stories' },
    { space_id: 1690369623748209, expectedUrl: 'https://app.storyblokchina.cn/v1/spaces/1690369623748209/stories' },
    { space_id: 1127419670326897, expectedUrl: 'https://api-ap.storyblok.com/v1/spaces/1127419670326897/stories' }
  ])('should call region-specific endpoints based on space_id', async ({ space_id, expectedUrl }) => {
    // Test with a space_id that has an embedded region
    // We don't know the exact mapping, so we'll just verify that region resolution is happening
    vi.clearAllMocks();
    
    const client = createClient({
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });

    await client.get({
      url: '/v1/spaces/{space_id}/stories',
      path: { space_id }
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [requestArg] = mockFetch.mock.calls[0];
    
    // Verify the URL contains the space_id and follows the expected pattern
    expect(requestArg.url).toBe(expectedUrl);
  });
});
