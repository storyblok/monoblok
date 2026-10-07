import { describe, expect, it } from "vitest";
import type { RateLimitContext, RateLimiter } from "./limiter";
import { createRequestAdmission } from "./request-admission";

const URL_UNDER_TEST = "https://api.storyblok.com/v1/stories";

const toContext = (path: string, query: Record<string, unknown>): RateLimitContext => ({
  path,
  query,
  bucket: "test",
  limit: 10,
});

/** Records what the admission tells a limiter about each request. */
const createRecordingLimiter = () => {
  const acquired: RateLimitContext[] = [];
  const released: RateLimitContext[] = [];
  const recorded: Array<{ context: RateLimitContext; status: number }> = [];

  return {
    acquired,
    released,
    recorded,
    limiter: {
      acquire: async (context) => {
        acquired.push(context);
      },
      release: (context) => {
        released.push(context);
      },
      recordResponse: (context, response) => {
        recorded.push({ context, status: response.status });
      },
    } satisfies RateLimiter,
  };
};

describe("createRequestAdmission", () => {
  it("should hand the limiter the context resolved from the request path and query", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const send = createRequestAdmission(limiter, toContext).wrapFetch(
      async () => new Response(null),
    );

    await send(`${URL_UNDER_TEST}?page=2&per_page=100`);

    expect(acquired[0]).toEqual({
      path: "/v1/stories",
      query: { page: "2", per_page: "100" },
      bucket: "test",
      limit: 10,
    });
  });

  it("should never hand the access token to the limiter", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const send = createRequestAdmission(limiter, toContext).wrapFetch(
      async () => new Response(null),
    );

    await send(`${URL_UNDER_TEST}?token=secret&per_page=100`);
    await send("not a url?token=secret");

    expect(acquired[0]?.query).toEqual({ per_page: "100" });
    expect(acquired[1]).toMatchObject({ path: "not a url", query: {} });
  });

  it("should read the URL of a Request and a URL object", async () => {
    const { limiter, acquired } = createRecordingLimiter();
    const send = createRequestAdmission(limiter, toContext).wrapFetch(
      async () => new Response(null),
    );

    await send(new Request(`${URL_UNDER_TEST}/home`));
    await send(new URL(`${URL_UNDER_TEST}/about`));

    expect(acquired.map((context) => context.path)).toEqual([
      "/v1/stories/home",
      "/v1/stories/about",
    ]);
  });

  it("should not admit a request twice when beforeRequest already admitted it", async () => {
    const { limiter, acquired, released } = createRecordingLimiter();
    const admission = createRequestAdmission(limiter, toContext);
    const send = admission.wrapFetch(async () => new Response(null));
    const request = new Request(URL_UNDER_TEST);

    await admission.beforeRequest(request);
    await send(request);

    expect(acquired).toHaveLength(1);
    expect(released).toEqual(acquired);
  });

  it("should give each in-flight request its own context to correlate on", async () => {
    const { limiter, acquired, released } = createRecordingLimiter();
    const send = createRequestAdmission(limiter, toContext).wrapFetch(
      async () => new Response(null),
    );

    await Promise.all([send(URL_UNDER_TEST), send(URL_UNDER_TEST), send(URL_UNDER_TEST)]);

    expect(new Set(acquired).size).toBe(3);
    // A limiter pairing a release to its acquire by identity has to find each
    // context it admitted.
    expect(acquired.every((context) => released.includes(context))).toBe(true);
  });

  it("should release the slot even when the request fails", async () => {
    const { limiter, released } = createRecordingLimiter();
    const send = createRequestAdmission(limiter, toContext).wrapFetch(() =>
      Promise.reject(new Error("boom")),
    );

    await expect(send(URL_UNDER_TEST)).rejects.toThrow("boom");

    expect(released).toHaveLength(1);
  });

  it("should make a retry win a slot of its own and report every response", async () => {
    const { limiter, acquired, recorded } = createRecordingLimiter();
    const statuses = [429, 429, 200];
    let attempt = 0;
    // Stands in for the HTTP layer retrying inside one call: admission that
    // only gated the call would let all of these through on one slot.
    const send = createRequestAdmission(limiter, toContext).wrapFetch(
      async () => new Response(null, { status: statuses[attempt++] }),
    );

    for (const _ of statuses) {
      await send(URL_UNDER_TEST);
    }

    expect(acquired).toHaveLength(3);
    expect(recorded.map((entry) => entry.status)).toEqual(statuses);
  });

  it("should serve the response when the limiter fails to record it", async () => {
    const send = createRequestAdmission(
      {
        acquire: () => Promise.resolve(),
        recordResponse: () => Promise.reject(new Error("shared store unreachable")),
        release: () => Promise.reject(new Error("shared store unreachable")),
      },
      toContext,
    ).wrapFetch(async () => new Response(null, { status: 200 }));

    // A blip in shared storage must not turn a served request into an error,
    // which inside the retry loop would also mean sending it again.
    await expect(send(URL_UNDER_TEST)).resolves.toMatchObject({ status: 200 });
  });

  it("should leave the response body readable by the caller", async () => {
    const send = createRequestAdmission(
      {
        acquire: () => Promise.resolve(),
        recordResponse: async (_context, response) => {
          await response.text();
        },
      },
      toContext,
    ).wrapFetch(async () => new Response("payload", { status: 200 }));

    const response = await send(URL_UNDER_TEST);

    await expect(response.text()).resolves.toBe("payload");
  });

  it("should fail the request when the limiter refuses admission", async () => {
    const send = createRequestAdmission(
      { acquire: () => Promise.reject(new Error("no slot")) },
      toContext,
    ).wrapFetch(async () => new Response(null, { status: 200 }));

    await expect(send(URL_UNDER_TEST)).rejects.toThrow("no slot");
  });
});
