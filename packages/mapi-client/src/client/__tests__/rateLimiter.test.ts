import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Instance Creation', () => {
    it('should create separate instances with different configurations', () => {
      const instance1 = new RateLimiter({ maxConcurrent: 3 });
      const instance2 = new RateLimiter({ maxConcurrent: 10 });
      
      expect(instance1).not.toBe(instance2);
      expect(instance1.getStats().maxConcurrent).toBe(3);
      expect(instance2.getStats().maxConcurrent).toBe(10);
    });

    it('should use default configuration when none provided', () => {
      const instance = new RateLimiter();
      
      expect(instance.getStats().maxConcurrent).toBe(5); // default
      expect(instance.getMaxRetries()).toBe(3); // default
      expect(instance.getRetryDelay()).toBe(1000); // default
    });
  });

  describe('Concurrency Limiting', () => {
    it('should limit concurrent requests to maxConcurrent', async () => {
      const rateLimiter = new RateLimiter({ maxConcurrent: 2 });
      
      let runningCount = 0;
      let maxRunning = 0;
      
      const mockFn = vi.fn().mockImplementation(async () => {
        runningCount++;
        maxRunning = Math.max(maxRunning, runningCount);
        
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 100));
        
        runningCount--;
        return 'success';
      });

      // Start 5 requests simultaneously
      const promises = Array(5).fill(null).map(() => rateLimiter.execute(mockFn));
      
      // Let initial requests start
      await vi.runOnlyPendingTimersAsync();
      
      // Fast-forward time to complete requests
      await vi.advanceTimersByTimeAsync(500);
      
      await Promise.all(promises);
      
      expect(maxRunning).toBeLessThanOrEqual(2);
      expect(mockFn).toHaveBeenCalledTimes(5);
    });

    it('should queue requests when at max concurrency', async () => {
      const rateLimiter = new RateLimiter({ maxConcurrent: 1 });
      
      const executionOrder: number[] = [];
      
      const createMockFn = (id: number) => vi.fn().mockImplementation(async () => {
        executionOrder.push(id);
        await new Promise(resolve => setTimeout(resolve, 50));
        return `result-${id}`;
      });

      const promises = [
        rateLimiter.execute(createMockFn(1)),
        rateLimiter.execute(createMockFn(2)),
        rateLimiter.execute(createMockFn(3))
      ];

      // Fast-forward to complete all requests
      await vi.advanceTimersByTimeAsync(200);
      
      await Promise.all(promises);
      
      // Should execute in order due to concurrency limit of 1
      expect(executionOrder).toEqual([1, 2, 3]);
    });
  });

  describe('Configuration Access', () => {
    it('should provide access to retry configuration', () => {
      const rateLimiter = new RateLimiter({ 
        retryDelay: 1000, 
        maxRetries: 2 
      });
      
      expect(rateLimiter.getMaxRetries()).toBe(2);
      expect(rateLimiter.getRetryDelay()).toBe(1000);
    });

  });

  describe('Configuration Updates', () => {
    it('should update configuration at runtime', () => {
      const rateLimiter = new RateLimiter({ maxConcurrent: 5 });
      
      expect(rateLimiter.getStats().maxConcurrent).toBe(5);
      
      rateLimiter.updateConfig({ maxConcurrent: 10, retryDelay: 2000 });
      
      expect(rateLimiter.getStats().maxConcurrent).toBe(10);
    });
  });

  describe('Stats Reporting', () => {
    it('should report accurate queue and running stats', async () => {
      const rateLimiter = new RateLimiter({ maxConcurrent: 2 });
      
      // Initially empty
      let stats = rateLimiter.getStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.maxConcurrent).toBe(2);

      const mockFn = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      });

      // Start multiple requests
      const promises = [
        rateLimiter.execute(mockFn),
        rateLimiter.execute(mockFn),
        rateLimiter.execute(mockFn)
      ];
      
      // Complete all requests
      await vi.advanceTimersByTimeAsync(300);
      await Promise.all(promises);

      // All should be completed now
      stats = rateLimiter.getStats();
      expect(stats.queueLength).toBe(0);
      expect(stats.running).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue gracefully', () => {
      const rateLimiter = new RateLimiter();
      const stats = rateLimiter.getStats();
      
      expect(stats.queueLength).toBe(0);
      expect(stats.running).toBe(0);
    });

    it('should handle synchronous functions', async () => {
      const rateLimiter = new RateLimiter();
      
      const syncFn = vi.fn().mockReturnValue('sync result');
      const result = await rateLimiter.execute(async () => syncFn());
      
      expect(result).toBe('sync result');
      expect(syncFn).toHaveBeenCalledTimes(1);
    });

    it('should handle functions that throw synchronously', async () => {
      const rateLimiter = new RateLimiter();
      
      const syncErrorFn = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      
      await expect(rateLimiter.execute(async () => syncErrorFn())).rejects.toThrow('Sync error');
      expect(syncErrorFn).toHaveBeenCalledTimes(1);
    });
  });
});