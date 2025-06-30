import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createManagementClient } from './index';
import { http, HttpResponse, server } from './test-setup/server';

// Mock console.log for verbose testing
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

describe('management Client', () => {
  // Setup MSW server
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
    vi.clearAllMocks();

    // Reset singleton instance by creating a new module instance
    vi.resetModules();
  });

  afterAll(() => {
    server.close();
  });

  describe('createManagementClient', () => {
    it('should create a new client instance with required token', () => {
      const client = createManagementClient({
        token: 'test-token-123',
      });

      expect(client).toBeDefined();
      expect(client.uuid).toMatch(/^management-client-[a-z0-9]+$/);
      expect(typeof client.init).toBe('function');
      expect(typeof client.request).toBe('function');
    });

    it('should create different instances on each call', () => {
      const client1 = createManagementClient({
        token: 'test-token-123',
      });

      const client2 = createManagementClient({
        token: 'test-token-456',
      });

      expect(client1.uuid).not.toBe(client2.uuid);
      expect(client1).not.toBe(client2);
    });

    it('should throw error when token is missing', () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        createManagementClient({});
      }).toThrow('Management API Client requires an access token for initialization');

      expect(() => {
        // @ts-expect-error - Testing invalid input
        createManagementClient();
      }).toThrow('Management API Client requires an access token for initialization');
    });

    it('should use default EU region when region is not specified', () => {
      const client = createManagementClient({
        token: 'test-token-123',
      });

      expect(client).toBeDefined();
    });

    it('should accept different regions', () => {
      const clientEU = createManagementClient({
        token: 'test-token-123',
        region: 'eu',
      });

      const clientUS = createManagementClient({
        token: 'test-token-456',
        region: 'us',
      });

      expect(clientEU).toBeDefined();
      expect(clientUS).toBeDefined();
      expect(clientEU.uuid).not.toBe(clientUS.uuid);
    });

    it('should handle verbose option', () => {
      const client = createManagementClient({
        token: 'test-token-123',
        verbose: true,
      });

      expect(client).toBeDefined();
    });
  });

  describe('managementClient (singleton)', () => {
    it('should create singleton instance on first call', async () => {
      // Reset modules to ensure clean singleton state
      vi.resetModules();

      const { managementClient: freshManagementClient } = await import('./index.js');

      const client = freshManagementClient({
        token: 'test-token-123',
      });

      expect(client).toBeDefined();
      expect(client.uuid).toMatch(/^management-client-[a-z0-9]+$/);
    });

    it('should return same instance on subsequent calls', async () => {
      // Reset modules to ensure clean singleton state
      vi.resetModules();

      const { managementClient: freshManagementClient } = await import('./index.js');

      const client1 = freshManagementClient({
        token: 'test-token-123',
      });

      const client2 = freshManagementClient();

      expect(client1).toBe(client2);
      expect(client1.uuid).toBe(client2.uuid);
    });

    it('should throw error on first call without token', async () => {
      // Reset modules to ensure clean singleton state
      vi.resetModules();

      const { managementClient: freshManagementClient } = await import('./index.js');

      expect(() => {
        freshManagementClient();
      }).toThrow('Management API Client requires an access token for initialization on first call');
    });

    it('should not require token on subsequent calls', async () => {
      // Reset modules to ensure clean singleton state
      vi.resetModules();

      const { managementClient: freshManagementClient } = await import('./index.js');

      // First call with token
      const client1 = freshManagementClient({
        token: 'test-token-123',
      });

      // Subsequent call without token should work
      expect(() => {
        const client2 = freshManagementClient();
        expect(client2).toBe(client1);
      }).not.toThrow();
    });
  });

  describe('client.request method', () => {
    it('should make successful GET request by default', async () => {
      const client = createManagementClient({
        token: 'test-token-123',
        region: 'eu',
      });

      const response = await client.request('spaces/123');

      expect(response).toEqual({
        data: {
          id: '123',
          name: 'Test Space',
          domain: 'test-space.com',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        attempt: 1,
      });
    });

    it('should make request with custom method and headers', async () => {
      const client = createManagementClient({
        token: 'test-token-123',
      });

      const response = await client.request('spaces/123', {
        method: 'POST',
        headers: {
          'Custom-Header': 'custom-value',
        },
        body: JSON.stringify({ name: 'New Space' }),
      });

      expect(response).toEqual({
        data: {
          success: true,
          received: { name: 'New Space' },
        },
        attempt: 1,
      });
    });

    it('should use correct URL for different regions', async () => {
      const clientUS = createManagementClient({
        token: 'test-token-123',
        region: 'us',
      });

      const responseUS = await clientUS.request('spaces/123');

      expect(responseUS.data).toEqual({
        id: '123',
        name: 'Test Space',
        domain: 'test-space.com',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      });

      const clientCN = createManagementClient({
        token: 'test-token-456',
        region: 'cn',
      });

      const responseCN = await clientCN.request('spaces/456');

      expect(responseCN.data).toEqual({
        id: '456',
        name: 'Test Space',
        domain: 'test-space.com',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
      });
    });

    it('should log request path when verbose is enabled', async () => {
      const client = createManagementClient({
        token: 'test-token-123',
        verbose: true,
      });

      await client.request('spaces/123');

      expect(mockConsoleLog).toHaveBeenCalledWith('✅ spaces/123');
    });

    it('should not log when verbose is disabled', async () => {
      const client = createManagementClient({
        token: 'test-token-123',
        verbose: false,
      });

      await client.request('spaces/123');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should throw error for non-JSON response', async () => {
      const client = createManagementClient({
        token: 'test-token-123',
      });

      await expect(client.request('spaces/non-json')).rejects.toThrow('Non-JSON response');
    });

    it('should throw error for failed request', async () => {
      const client = createManagementClient({
        token: 'test-token-123',
      });

      await expect(client.request('spaces/invalid')).rejects.toThrow('Request failed');
    });

    it('should handle unauthorized requests', async () => {
      // Override the handler to not require authorization for this test
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/unauthorized', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),
      );

      const client = createManagementClient({
        token: 'invalid-token',
      });

      await expect(client.request('spaces/unauthorized')).rejects.toThrow('Request failed');
    });

    it('should handle network errors', async () => {
      // Add a handler that simulates a network error
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/network-error', () => {
          return HttpResponse.error();
        }),
      );

      const client = createManagementClient({
        token: 'test-token-123',
      });

      await expect(client.request('spaces/network-error')).rejects.toThrow();
    });

    it('should validate request headers are sent correctly', async () => {
      let capturedHeaders: Headers | undefined;

      // Override handler to capture headers
      server.use(
        http.get('https://mapi.storyblok.com/v1/spaces/header-test', ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({ success: true });
        }),
      );

      const client = createManagementClient({
        token: 'test-token-123',
      });

      await client.request('spaces/header-test', {
        headers: {
          'X-Custom-Header': 'test-value',
        },
      });

      expect(capturedHeaders?.get('authorization')).toBe('test-token-123');
      expect(capturedHeaders?.get('content-type')).toBe('application/json');
      expect(capturedHeaders?.get('x-custom-header')).toBe('test-value');
    });
  });

  describe('client.init method', () => {
    it('should allow re-initialization with new options', () => {
      const client = createManagementClient({
        token: 'old-token',
        region: 'eu',
      });

      // Re-initialize with new options
      expect(() => {
        client.init({
          token: 'new-token',
          region: 'us',
          verbose: true,
        });
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty path in request', async () => {
      const client = createManagementClient({
        token: 'test-token-123',
      });

      const response = await client.request('');

      expect(response.data).toEqual({ message: 'API Root' });
    });

    it('should handle request without fetchOptions', async () => {
      const client = createManagementClient({
        token: 'test-token-123',
      });

      const response = await client.request('spaces/123');

      expect(response).toEqual({
        data: {
          id: '123',
          name: 'Test Space',
          domain: 'test-space.com',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
        },
        attempt: 1,
      });
    });

    it('should generate unique UUIDs for different instances', () => {
      const uuids = new Set();

      // Create multiple clients and collect UUIDs
      for (let i = 0; i < 10; i++) {
        const client = createManagementClient({
          token: `test-token-${i}`,
        });
        uuids.add(client.uuid);
      }

      // All UUIDs should be unique
      expect(uuids.size).toBe(10);
    });

    it('should handle malformed JSON in request body gracefully', async () => {
      // Override handler for this specific test
      server.use(
        http.post('https://mapi.storyblok.com/v1/spaces/malformed', () => {
          return HttpResponse.json({ error: 'Bad Request' }, { status: 400 });
        }),
      );

      const client = createManagementClient({
        token: 'test-token-123',
      });

      await expect(
        client.request('spaces/malformed', {
          method: 'POST',
          body: 'invalid-json',
        }),
      ).rejects.toThrow('Request failed');
    });
  });
});
