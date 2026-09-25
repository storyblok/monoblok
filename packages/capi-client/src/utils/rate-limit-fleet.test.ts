// Several client instances sharing one token against a server that enforces the
// quota per token: each instance paces itself correctly and the fleet still
// overruns the quota between them.

import { afterEach, describe, expect, it, vi } from "vitest";
import { createThrottleManager } from "./rate-limit";
import { createDefaultRateLimiter, type RateLimiter } from "./limiter";

const QUOTA_PER_SECOND = 10;
const REQUESTS_PER_INSTANCE = 200;
/** Requests each instance keeps in flight, as a build fetching pages would. */
const CONCURRENCY = 6;
const MAX_RETRIES = 2;
/** Round trip to the API, so instances are not locked into the same instant. */
const LATENCY_MS = 40;
const PATH = "/v2/cdn/stories";
const URL = `https://api.storyblok.com${PATH}`;

/** The API: one rolling one-second window held against the token, not the client. */
function createQuotaServer(quota: number) {
  const starts: number[] = [];
  let refused = 0;

  return {
    get refused() {
      return refused;
    },
    handle(): number {
      const now = Date.now();
      while (starts.length > 0 && starts[0] <= now - 1000) {
        starts.shift();
      }
      if (starts.length >= quota) {
        refused++;
        return 429;
      }
      starts.push(now);
      return 200;
    },
  };
}

interface FleetResult {
  /** Requests abandoned after the retries ran out. */
  dropped: number;
  /** 429 answers the fleet received, retried ones included. */
  refused: number;
}

interface FleetOptions {
  instances: number;
  adaptive?: boolean;
  /** A limiter every instance shares, standing in for one backed by Redis. */
  sharedLimiter?: RateLimiter;
}

async function runFleet({
  instances,
  adaptive = true,
  sharedLimiter,
}: FleetOptions): Promise<FleetResult> {
  const server = createQuotaServer(QUOTA_PER_SECOND);
  let dropped = 0;
  let finished = false;

  const work = Array.from({ length: instances }, () => {
    // `requestsPerSecond` is what the instance would have used on its own; a
    // shared limiter reads it as `context.limit` and spends it fleet-wide.
    const manager = createThrottleManager({
      requestsPerSecond: QUOTA_PER_SECOND,
      adaptive,
      ...(sharedLimiter ? { limiter: sharedLimiter } : {}),
    });
    const send = manager.wrapFetch(async () => {
      const status = server.handle();
      await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
      return new Response(null, { status });
    });

    let remaining = REQUESTS_PER_INSTANCE;
    const worker = async () => {
      while (remaining-- > 0) {
        await manager.execute(PATH, {}, async () => {
          for (let attempt = 0; ; attempt++) {
            const response = await send(URL);
            if (response.status !== 429) {
              return;
            }
            if (attempt >= MAX_RETRIES) {
              dropped++;
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
          }
        });
      }
    };

    return Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  });

  const all = Promise.all(work).then(() => {
    finished = true;
  });
  // The fleet only makes progress as the rolling windows age out, so drive the
  // clock until every instance has drained its workload.
  for (let step = 0; step < 5_000 && !finished; step++) {
    await vi.advanceTimersByTimeAsync(100);
  }
  await all;

  return { dropped, refused: server.refused };
}

describe("instances sharing one token", () => {
  afterEach(() => vi.useRealTimers());

  it("should not throttle a single instance, adaptive or not", async () => {
    vi.useFakeTimers();

    const adaptive = await runFleet({ instances: 1 });
    const fixed = await runFleet({ instances: 1, adaptive: false });

    expect(adaptive).toEqual({ dropped: 0, refused: 0 });
    expect(fixed).toEqual({ dropped: 0, refused: 0 });
  });

  it("should drop far fewer requests than a fixed rate when four instances share a token", async () => {
    vi.useFakeTimers();

    const adaptive = await runFleet({ instances: 4 });
    const fixed = await runFleet({ instances: 4, adaptive: false });

    expect(fixed.dropped).toBeGreaterThan(0);
    // Adaptation cannot prevent the first overrun — it only reacts to one — so
    // the guarantee is a large reduction, not zero.
    expect(adaptive.dropped).toBeLessThan(fixed.dropped / 4);
    expect(adaptive.refused).toBeLessThan(fixed.refused / 2);
  });

  it("should not be throttled at all when the instances share one limiter", async () => {
    vi.useFakeTimers();

    // The quota is the limiter's to spend, so the fleet never offers more than
    // the token allows — no 429 to react to in the first place.
    const sharedLimiter = createDefaultRateLimiter({ adaptive: false });
    const shared = await runFleet({ instances: 4, sharedLimiter });

    expect(shared).toEqual({ dropped: 0, refused: 0 });
  });
});
