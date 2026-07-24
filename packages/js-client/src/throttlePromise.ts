import type { ISbThrottle } from './interfaces';

class AbortError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'AbortError';
  }
}

/**
 * Wraps `fn` in a per-second rate limiter. At most `limit` calls may start
 * within any rolling `interval` (default 1000ms); once the window is full,
 * further calls wait until the oldest call in it ages out. This matches how the
 * Storyblok API enforces its limits: a fixed number of requests per one-second
 * window, not a cap on the number of simultaneous requests.
 *
 * The limiter holds only a list of recent start timestamps, pruned against
 * `Date.now()` on every attempt, and every wait resolves the promise the caller
 * already awaits. It therefore keeps no counter that a scheduled callback must
 * decrement, and schedules no timer that outlives the awaited call. That is a
 * hard requirement on runtimes which suspend between requests and drop pending
 * timers (for example Cloudflare Workers): a shared limiter that released its
 * slots from a detached timer would leak its in-flight count across requests
 * until it deadlocked (see issues #533 and #319).
 *
 * A non-positive or non-finite `limit` or `interval` disables throttling and
 * lets every call through. Server-side rate limits remain enforced by the
 * client's 429 retry path.
 */
function throttledQueue<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number,
  interval: number,
): ISbThrottle<T> {
  const isUnlimited
    = !Number.isFinite(limit) || limit <= 0
      || !Number.isFinite(interval) || interval <= 0;

  // Start timestamps of the calls currently inside the rolling window.
  const starts: number[] = [];
  // Rejecters for calls waiting on the window, so abort() can settle them.
  const pending = new Set<(reason: unknown) => void>();
  let isAborted = false;

  const acquire = (): Promise<void> => {
    if (isUnlimited) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const attempt = () => {
        if (isAborted) {
          reject(new AbortError('Throttle function aborted'));
          return;
        }

        const now = Date.now();
        while (starts.length > 0 && starts[0] <= now - interval) {
          starts.shift();
        }

        if (starts.length < limit) {
          starts.push(now);
          resolve();
          return;
        }

        // Window is full: retry once the oldest call ages out. The timer only
        // resolves the promise the caller awaits, so it is never orphaned.
        const wait = starts[0] + interval - now;
        let reject_: (reason: unknown) => void;
        const id = setTimeout(() => {
          pending.delete(reject_);
          attempt();
        }, wait > 0 ? wait : 0);
        reject_ = (reason: unknown) => {
          clearTimeout(id);
          reject(reason);
        };
        pending.add(reject_);
      };

      attempt();
    });
  };

  const throttled: ISbThrottle<T> = (...args) => {
    if (isAborted) {
      return Promise.reject(
        new Error(
          'Throttled function is already aborted and not accepting new promises',
        ),
      );
    }

    return acquire().then(() => fn(...args));
  };

  throttled.abort = () => {
    isAborted = true;
    pending.forEach(reject_ =>
      reject_(new AbortError('Throttle function aborted')),
    );
    pending.clear();
  };

  return throttled;
}

export default throttledQueue;
