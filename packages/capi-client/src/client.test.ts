import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client";
import type { RateLimitContext, RateLimiter } from "./utils/limiter";

const storyResponse = () =>
  new Response(JSON.stringify({ story: { id: 1, content: {} }, cv: 1 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("createApiClient rate limiting", () => {
  it("should not spend the request timeout on time queued behind the rate limit", async () => {
    const client = createApiClient({
      accessToken: "token",
      // Three requests at one per second outlast the timeout while waiting
      // their turn, though none of them is itself slow.
      rateLimit: { requestsPerSecond: 1, adaptive: false },
      timeout: 1000,
      fetch: async () => storyResponse(),
    });

    const results = await Promise.allSettled([
      client.stories.get("a"),
      client.stories.get("b"),
      client.stories.get("c"),
    ]);

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
  });

  it("should route real requests through a custom limiter", async () => {
    const acquired: RateLimitContext[] = [];
    const released: RateLimitContext[] = [];
    const limiter: RateLimiter = {
      acquire: async (context) => {
        acquired.push(context);
      },
      release: (context) => {
        released.push(context);
      },
    };
    const client = createApiClient({
      accessToken: "token",
      rateLimit: { limiter },
      fetch: async () => storyResponse(),
    });

    await client.stories.get("home");

    expect(acquired).toHaveLength(1);
    expect(acquired[0]).toMatchObject({ bucket: "SINGLE_OR_SMALL", limit: 50 });
    expect(released).toHaveLength(1);
  });

  it("should report a throttled response to the limiter even when a retry succeeds", async () => {
    const statuses: number[] = [];
    const limiter: RateLimiter = {
      acquire: () => Promise.resolve(),
      recordResponse: (_context, response) => {
        statuses.push(response.status);
      },
    };
    let attempt = 0;
    const client = createApiClient({
      accessToken: "token",
      rateLimit: { limiter },
      retry: { limit: 1, backoffLimit: 10 },
      fetch: async () => {
        attempt++;
        return attempt === 1 ? new Response(null, { status: 429 }) : storyResponse();
      },
    });

    await client.stories.get("home");

    // The 429 the retry replaced is the signal a limiter has to act on; only
    // the final 200 would ever reach a caller.
    expect(statuses).toEqual([429, 200]);
  });

  it("should still read a fetch swapped in after the client was created", async () => {
    const originalFetch = globalThis.fetch;
    const client = createApiClient({ accessToken: "token", rateLimit: false });
    const stub = vi.fn(async () => storyResponse());
    globalThis.fetch = stub as unknown as typeof globalThis.fetch;

    try {
      await client.stories.get("home");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(stub).toHaveBeenCalled();
  });
});
