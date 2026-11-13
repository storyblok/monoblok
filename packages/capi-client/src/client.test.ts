import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createApiClient, type HttpRequestOptions } from "./client";
import { ClientError } from "./error";
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

describe("createApiClient get()", () => {
  type Links = { links: Record<string, unknown> };
  const linksResponse = () =>
    new Response(JSON.stringify({ links: { a: {} } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("should type data with the given type argument", async () => {
    const client = createApiClient({ accessToken: "token", fetch: async () => linksResponse() });

    const result = await client.get<Links>("/v2/cdn/links");

    expectTypeOf(result.data).toEqualTypeOf<Links | undefined>();
    expect(result.data?.links).toEqual({ a: {} });
  });

  it("should type data as non-optional when throwOnError is enabled", async () => {
    const client = createApiClient({
      accessToken: "token",
      throwOnError: true,
      fetch: async () => linksResponse(),
    });

    const result = await client.get<Links>("/v2/cdn/links");

    expectTypeOf(result.data).toEqualTypeOf<Links>();
    expect(result.data.links).toEqual({ a: {} });
  });

  it("should reject on HTTP errors when throwOnError is enabled", async () => {
    const client = createApiClient({
      accessToken: "token",
      throwOnError: true,
      fetch: async () => new Response(null, { status: 404 }),
    });

    await expect(client.get<Links>("/v2/cdn/links")).rejects.toBeInstanceOf(ClientError);
    await expect(
      client.get<Links>("/v2/cdn/links", { throwOnError: undefined }),
    ).rejects.toBeInstanceOf(ClientError);
  });

  it("should type data as optional when a call disables throwOnError", async () => {
    const client = createApiClient({
      accessToken: "token",
      throwOnError: true,
      fetch: async () => new Response(null, { status: 404 }),
    });

    const result = await client.get<Links>("/v2/cdn/links", { throwOnError: false });

    expectTypeOf(result.data).toEqualTypeOf<Links | undefined>();
    expect(result.data).toBeUndefined();
    expect(result.error).toBeInstanceOf(ClientError);
  });

  it("should type data as non-optional when a call enables throwOnError", async () => {
    const client = createApiClient({ accessToken: "token", fetch: async () => linksResponse() });

    const result = await client.get<Links>("/v2/cdn/links", { throwOnError: true });

    expectTypeOf(result.data).toEqualTypeOf<Links>();
    expect(result.data.links).toEqual({ a: {} });
  });

  it("should accept forwarded HttpRequestOptions", async () => {
    const client = createApiClient({ accessToken: "token", fetch: async () => linksResponse() });
    const options: HttpRequestOptions = { query: { version: "draft" } };

    const result = await client.get<Links>("/v2/cdn/links", options);

    expectTypeOf(result.data).toEqualTypeOf<Links | undefined>();
    expect(result.data?.links).toEqual({ a: {} });
  });

  it("should not accept responseStyle", () => {
    const client = createApiClient({ accessToken: "token", fetch: async () => linksResponse() });

    // @ts-expect-error `responseStyle: "data"` would return the unwrapped body
    void client.get<Links>("/v2/cdn/links", { responseStyle: "data" });
  });
});
