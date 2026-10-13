export interface Throttle {
  /** Resolves once a slot in the window is available. */
  acquire: () => Promise<void>;
  /** Runs `fn` once a slot in the window is available and returns its result. */
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Adjusts the limit applied to subsequent windows. */
  setLimit: (limit: number) => void;
  /** Limit currently applied. */
  getLimit: () => number;
  /**
   * Rejects every call waiting for a slot with an `AbortError`, and every later
   * call too. Calls already started still settle.
   */
  abort: () => void;
}

export interface ThrottleOptions {
  /**
   * Length of the rolling window in milliseconds. A non-positive or non-finite
   * value disables throttling.
   * @default 1000
   */
  intervalMs?: number;
}

class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AbortError";
  }
}

const DEFAULT_INTERVAL_MS = 1000;

/**
 * Creates a rate limiter. At most `limit` calls may start within any rolling
 * window (one second by default); once the window is full, further calls wait
 * until the oldest call in it ages out. This matches how the Storyblok API
 * enforces its limits: a fixed number of requests per one-second window, not a
 * cap on the number of simultaneous requests.
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
 * A non-positive or non-finite `limit` or interval disables throttling and lets
 * every call through.
 */
export function createThrottle(initialLimit: number, options: ThrottleOptions = {}): Throttle {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const hasInterval = Number.isFinite(intervalMs) && intervalMs > 0;
  let limit = initialLimit;
  // Start timestamps of the calls currently inside the rolling window.
  const starts: number[] = [];
  // Cancels the retry timer of each call waiting on the window, so abort() can settle them.
  const waiting = new Set<(reason: unknown) => void>();
  let isAborted = false;

  const isUnlimited = () => !hasInterval || !Number.isFinite(limit) || limit <= 0;

  const acquire = (): Promise<void> => {
    if (isAborted) {
      return Promise.reject(new AbortError("Throttle function aborted"));
    }
    if (isUnlimited()) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const attempt = () => {
        // The limit can drop to a non-positive or non-finite value (via
        // setLimit) while this call is waiting. Re-check the disabled guard so
        // parked callers resolve instead of rescheduling forever.
        if (isUnlimited()) {
          resolve();
          return;
        }

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
        const cancel = (reason: unknown) => {
          clearTimeout(timer);
          reject(reason);
        };
        const timer = setTimeout(
          () => {
            waiting.delete(cancel);
            attempt();
          },
          wait > 0 ? wait : 0,
        );
        waiting.add(cancel);
      };

      attempt();
    });
  };

  return {
    acquire,
    execute: <T>(fn: () => Promise<T>): Promise<T> => acquire().then(fn),
    setLimit: (n: number) => {
      limit = n;
    },
    getLimit: () => limit,
    abort: () => {
      isAborted = true;
      for (const cancel of waiting) {
        cancel(new AbortError("Throttle function aborted"));
      }
      waiting.clear();
    },
  };
}
