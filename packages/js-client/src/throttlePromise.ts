import type { ISbThrottle, Queue } from './interfaces';

class AbortError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'AbortError';
  }
}

/**
 * Creates a concurrency-limited queue: at most `limit` invocations of `fn` run
 * at the same time. A concurrency slot is released as soon as its invocation
 * settles (in a `finally`), and the queue keeps draining from there.
 *
 * Release and draining are intentionally completion-driven and never depend on
 * a scheduled timer. On runtimes such as Cloudflare Workers the isolate can
 * suspend right after a response is sent and drop pending timers; a
 * timer-driven release would then leak the in-flight count across requests
 * (the client is a shared singleton) until the queue permanently deadlocks and
 * the Worker returns 1101 (see #533, #319). Server-side rate limits are still
 * respected by the 429 retry path in the client.
 *
 * A non-positive or non-finite `limit` disables throttling and lets every
 * request through. `_interval` is retained for internal API compatibility and
 * is no longer used, because any timer-based pacing would reintroduce the
 * Workers hang described above.
 */
function throttledQueue<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number,
  _interval: number,
): ISbThrottle<T> {
  const isUnlimited = !Number.isFinite(limit) || limit <= 0;

  const queue: Queue<Parameters<T>>[] = [];
  let activeCount = 0;
  let isAborted = false;

  const next = async () => {
    const item = queue.shift();
    if (!item) {
      return;
    }

    activeCount++;
    try {
      item.resolve(await fn(...item.args));
    }
    catch (error) {
      item.reject(error);
    }
    finally {
      activeCount--;
      if (queue.length > 0 && (isUnlimited || activeCount < limit)) {
        next();
      }
    }
  };

  const throttled: ISbThrottle<T> = (...args) => {
    if (isAborted) {
      return Promise.reject(
        new Error(
          'Throttled function is already aborted and not accepting new promises',
        ),
      );
    }

    return new Promise((resolve, reject) => {
      queue.push({
        resolve,
        reject,
        args,
      });

      if (isUnlimited || activeCount < limit) {
        next();
      }
    });
  };

  throttled.abort = () => {
    isAborted = true;

    queue.forEach(item =>
      item.reject(new AbortError('Throttle function aborted')),
    );
    queue.length = 0;
  };

  return throttled;
}

export default throttledQueue;
