interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

declare global {
  function setImmediate(callback: (...args: any[]) => void): void;
}

export interface RateLimitConfig {
  maxConcurrent?: number;
  retryDelay?: number;
  maxRetries?: number;
}

export class RateLimiter {
  private queue: QueueItem[] = [];
  private running = 0;
  private maxConcurrent: number;
  private retryDelay: number;
  private maxRetries: number;

  // Pushes the execution of the function to the next tick of the event loop
  private nextTick: (fn: () => void) => void;

  constructor(config: RateLimitConfig = {}) {
    this.maxConcurrent = config.maxConcurrent ?? 5;
    this.retryDelay = config.retryDelay ?? 1000; // 1 second default
    this.maxRetries = config.maxRetries ?? 3;
    this.nextTick = typeof setImmediate !== 'undefined' ? setImmediate : (fn: () => void) => setTimeout(fn, 0);
  }

  private async processQueue(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.running++;

    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.running--;
      // Process next item in queue
      if (this.queue.length > 0) {
        this.nextTick(() => this.processQueue());
      }
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject
      });

      this.processQueue();
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateConfig(config: Partial<RateLimitConfig>): void {
    if (config.maxConcurrent) this.maxConcurrent = config.maxConcurrent;
    if (config.retryDelay) this.retryDelay = config.retryDelay;
    if (config.maxRetries) this.maxRetries = config.maxRetries;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      running: this.running,
      maxConcurrent: this.maxConcurrent
    };
  }

  getMaxRetries(): number {
    return this.maxRetries;
  }

  getRetryDelay(): number {
    return this.retryDelay;
  }
}
