import throttledQueue from './throttlePromise';
import type { ISbThrottle, ISbThrottledRequest } from './interfaces';

/**
 * Manages multiple throttle queues, each with different rate limits.
 * This ensures that requests with different rate limits don't interfere with each other.
 *
 * For example, cached requests (1000 req/s) and uncached requests (50 req/s)
 * will use separate queues, preventing the slower queue from affecting the faster one.
 */
export class ThrottleQueueManager {
  private queues: Map<number, ISbThrottle<ISbThrottledRequest>>;
  private interval: number;
  private throttledRequestFn: ISbThrottledRequest;

  constructor(throttledRequestFn: ISbThrottledRequest, interval = 1000) {
    this.queues = new Map();
    this.interval = interval;
    this.throttledRequestFn = throttledRequestFn;
  }

  /**
   * Gets or creates a throttle queue for the specified rate limit
   */
  private getQueue(rateLimit: number): ISbThrottle<ISbThrottledRequest> {
    let queue = this.queues.get(rateLimit);

    if (!queue) {
      queue = throttledQueue(
        this.throttledRequestFn,
        rateLimit,
        this.interval,
      );
      this.queues.set(rateLimit, queue);
    }

    return queue;
  }

  /**
   * Executes a request through the appropriate throttle queue based on rate limit
   */
  public execute(
    rateLimit: number,
    ...args: Parameters<ISbThrottledRequest>
  ): Promise<unknown> {
    const queue = this.getQueue(rateLimit);
    return queue(...args);
  }

  /**
   * Aborts all throttle queues
   */
  public abortAll(): void {
    this.queues.forEach((queue) => {
      queue.abort?.();
    });
    this.queues.clear();
  }

  /**
   * Gets the number of active queues
   */
  public getQueueCount(): number {
    return this.queues.size;
  }
}
