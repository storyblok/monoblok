import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThrottleQueueManager } from './throttleQueueManager';
import type { ISbThrottledRequest } from './interfaces';

describe('throttleQueueManager', () => {
  let mockThrottledRequest: ISbThrottledRequest;
  let manager: ThrottleQueueManager;

  beforeEach(() => {
    mockThrottledRequest = vi.fn(async () => ({ data: 'test' }));
    manager = new ThrottleQueueManager(mockThrottledRequest, 1000);
  });

  describe('initialization', () => {
    it('should create a manager with no queues initially', () => {
      expect(manager.getQueueCount()).toBe(0);
    });

    it('should accept custom interval', () => {
      const customManager = new ThrottleQueueManager(mockThrottledRequest, 500);
      expect(customManager).toBeDefined();
      expect(customManager.getQueueCount()).toBe(0);
    });
  });

  describe('queue creation', () => {
    it('should create a queue on first request with specific rate limit', async () => {
      const promise = manager.execute(50, 'get', '/test', {});
      expect(manager.getQueueCount()).toBe(1);

      try {
        await promise;
      }
      catch {
        // Expected to fail with mock
      }
    });

    it('should reuse existing queue for same rate limit', async () => {
      const promise1 = manager.execute(50, 'get', '/test1', {});
      const promise2 = manager.execute(50, 'get', '/test2', {});

      expect(manager.getQueueCount()).toBe(1);

      try {
        await Promise.all([promise1, promise2]);
      }
      catch {
        // Expected to fail with mock
      }
    });

    it('should create separate queues for different rate limits', async () => {
      const promise1 = manager.execute(50, 'get', '/test1', {});
      const promise2 = manager.execute(1000, 'get', '/test2', {});
      const promise3 = manager.execute(15, 'get', '/test3', {});

      expect(manager.getQueueCount()).toBe(3);

      try {
        await Promise.all([promise1, promise2, promise3]);
      }
      catch {
        // Expected to fail with mock
      }
    });

    it('should maintain separate queues for different rate limits over multiple calls', async () => {
      // First batch
      await manager.execute(50, 'get', '/test1', {}).catch(() => {});
      await manager.execute(1000, 'get', '/test2', {}).catch(() => {});

      expect(manager.getQueueCount()).toBe(2);

      // Second batch - should reuse existing queues
      await manager.execute(50, 'get', '/test3', {}).catch(() => {});
      await manager.execute(1000, 'get', '/test4', {}).catch(() => {});

      expect(manager.getQueueCount()).toBe(2);
    });
  });

  describe('request execution', () => {
    it('should pass arguments to throttled request function', async () => {
      await manager.execute(50, 'get', '/test', { version: 'draft' }).catch(() => {});

      expect(mockThrottledRequest).toHaveBeenCalledWith(
        'get',
        '/test',
        { version: 'draft' },
      );
    });

    it('should pass all arguments including fetchOptions', async () => {
      const fetchOptions = { headers: { 'Custom-Header': 'value' } };
      await manager.execute(50, 'get', '/test', { version: 'draft' }, fetchOptions).catch(() => {});

      expect(mockThrottledRequest).toHaveBeenCalledWith(
        'get',
        '/test',
        { version: 'draft' },
        fetchOptions,
      );
    });

    it('should return promise from throttled request', async () => {
      const mockResponse = { data: 'response' };
      mockThrottledRequest = vi.fn(async () => mockResponse);
      manager = new ThrottleQueueManager(mockThrottledRequest, 1000);

      const result = await manager.execute(50, 'get', '/test', {});
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors from throttled request', async () => {
      const error = new Error('Request failed');
      mockThrottledRequest = vi.fn(async () => {
        throw error;
      });
      manager = new ThrottleQueueManager(mockThrottledRequest, 1000);

      await expect(manager.execute(50, 'get', '/test', {})).rejects.toThrow('Request failed');
    });
  });

  describe('queue isolation', () => {
    it('should process requests with different rate limits independently', async () => {
      const calls: string[] = [];

      mockThrottledRequest = vi.fn(async (method, url) => {
        calls.push(url);
        await new Promise(resolve => setTimeout(resolve, 50));
        return { data: url };
      });

      manager = new ThrottleQueueManager(mockThrottledRequest, 100);

      // Start requests with different rate limits
      const promises = [
        manager.execute(1000, 'get', '/fast1', {}),
        manager.execute(1000, 'get', '/fast2', {}),
        manager.execute(1, 'get', '/slow1', {}),
        manager.execute(1, 'get', '/slow2', {}),
      ];

      await Promise.all(promises);

      // Fast requests should not be affected by slow rate limit
      expect(calls).toHaveLength(4);
      expect(calls).toContain('/fast1');
      expect(calls).toContain('/fast2');
      expect(calls).toContain('/slow1');
      expect(calls).toContain('/slow2');
    });
  });

  describe('abortAll', () => {
    it('should abort all queues', () => {
      manager.execute(50, 'get', '/test1', {}).catch(() => {});
      manager.execute(1000, 'get', '/test2', {}).catch(() => {});
      manager.execute(15, 'get', '/test3', {}).catch(() => {});

      expect(manager.getQueueCount()).toBe(3);

      manager.abortAll();

      expect(manager.getQueueCount()).toBe(0);
    });

    it('should clear all queues after abort', () => {
      manager.execute(50, 'get', '/test1', {}).catch(() => {});
      manager.execute(1000, 'get', '/test2', {}).catch(() => {});

      manager.abortAll();

      expect(manager.getQueueCount()).toBe(0);
    });

    it('should allow creating new queues after abort', async () => {
      manager.execute(50, 'get', '/test1', {}).catch(() => {});
      manager.abortAll();

      expect(manager.getQueueCount()).toBe(0);

      await manager.execute(100, 'get', '/test2', {}).catch(() => {});

      expect(manager.getQueueCount()).toBe(1);
    });
  });

  describe('common rate limit scenarios', () => {
    it('should handle typical cached request rate limit (1000 req/s)', async () => {
      await manager.execute(1000, 'get', '/cached', { version: 'published' }).catch(() => {});

      expect(manager.getQueueCount()).toBe(1);
      expect(mockThrottledRequest).toHaveBeenCalled();
    });

    it('should handle typical uncached request rate limits', async () => {
      // Small listing - 50 req/s
      await manager.execute(50, 'get', '/draft-small', { version: 'draft', per_page: 25 }).catch(() => {});

      // Medium listing - 15 req/s
      await manager.execute(15, 'get', '/draft-medium', { version: 'draft', per_page: 40 }).catch(() => {});

      // Large listing - 10 req/s
      await manager.execute(10, 'get', '/draft-large', { version: 'draft', per_page: 60 }).catch(() => {});

      // Very large listing - 6 req/s
      await manager.execute(6, 'get', '/draft-xlarge', { version: 'draft', per_page: 100 }).catch(() => {});

      expect(manager.getQueueCount()).toBe(4);
    });

    it('should handle mixed cached and uncached requests', async () => {
      const promises = [
        manager.execute(1000, 'get', '/cached1', { version: 'published' }),
        manager.execute(50, 'get', '/draft1', { version: 'draft' }),
        manager.execute(1000, 'get', '/cached2', { version: 'published' }),
        manager.execute(50, 'get', '/draft2', { version: 'draft' }),
      ];

      await Promise.allSettled(promises);

      // Should have 2 queues: one for 1000 req/s, one for 50 req/s
      expect(manager.getQueueCount()).toBe(2);
    });
  });
});
