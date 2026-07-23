// This file is duplicated verbatim in @storyblok/api-client and
// @storyblok/management-api-client. The two copies must stay identical; apply
// any change to both. It is intentionally not extracted into a shared package
// so the two independently published clients keep no shared runtime dependency.

export interface Throttle {
  /** Runs `fn` once a per-second slot is available and returns its result. */
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Adjusts the per-second limit applied to subsequent windows. */
  setLimit: (limit: number) => void;
}

/**
 * Creates a per-second rate limiter. At most `limit` calls may start within any
 * rolling one-second window; once the window is full, further calls wait until
 * the oldest call in it ages out. This matches how the Storyblok API enforces
 * its limits: a fixed number of requests per one-second window, not a cap on
 * the number of simultaneous requests.
 *
 * The limiter holds only a list of recent start timestamps, pruned against
 * `Date.now()` on every attempt, and every wait resolves the promise the caller
 * already awaits. It therefore keeps no counter that a scheduled callback must
 * decrement, and schedules no timer that outlives the awaited call. That is a
 * hard requirement on runtimes which suspend between requests and drop pending
 * timers (for example Cloudflare Workers): a shared limiter that released its
 * slots from a detached timer would leak its in-flight count across requests
 * until it deadlocked.
 *
 * A non-positive or non-finite `limit` disables throttling and lets every call
 * through.
 */
export function createThrottle(initialLimit: number): Throttle {
  const intervalMs = 1000;
  let limit = initialLimit;
  // Start timestamps of the calls currently inside the rolling window.
  const starts: number[] = [];

  const acquire = (): Promise<void> => {
    if (!Number.isFinite(limit) || limit <= 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const attempt = () => {
        const now = Date.now();
        while (starts.length > 0 && starts[0] <= now - intervalMs) {
          starts.shift();
        }

        if (starts.length < limit) {
          starts.push(now);
          resolve();
          return;
        }

        // Window is full: retry once the oldest call ages out. The timer only
        // resolves the promise the caller awaits, so it is never orphaned.
        const wait = starts[0] + intervalMs - now;
        setTimeout(attempt, wait > 0 ? wait : 0);
      };

      attempt();
    });
  };

  return {
    execute: <T>(fn: () => Promise<T>): Promise<T> => acquire().then(fn),
    setLimit: (n: number) => {
      limit = n;
    },
  };
}
