import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SbFetch from "./sbFetch";
import StoryblokClient from "./index";

describe("fetch timeout cleanup", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(["network rejection", "abort rejection", "synchronous exception"])(
    "should clear the timer after %s",
    async (failure) => {
      const error = new Error("Fetch failed");
      if (failure === "abort rejection") {
        error.name = "AbortError";
      }
      const fetch = vi.fn<typeof globalThis.fetch>(() => {
        if (failure === "synchronous exception") {
          throw error;
        }
        return Promise.reject(error);
      });
      const transport = new SbFetch({ baseURL: "https://example.test/", timeout: 10, fetch });

      const result = await transport.get("stories", {});

      expect(result).toEqual({
        message:
          failure === "abort rejection"
            ? "Request timeout: The request was aborted due to timeout"
            : "Fetch failed",
      });
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("should keep successful requests free of pending timeouts", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ story: {} }), { status: 200 }));
    const transport = new SbFetch({ baseURL: "https://example.test/", timeout: 10, fetch });
    const result = await transport.get("stories", {});
    expect(result).toHaveProperty("status", 200);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should preserve disabled timeouts on failure", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("Fetch failed"));
    const transport = new SbFetch({ baseURL: "https://example.test/", timeout: 0, fetch });
    expect(await transport.get("stories", {})).toEqual({ message: "Fetch failed" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should release the timeout through the public client on failure", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("Fetch failed"));
    const client = new StoryblokClient({ accessToken: "test-token", timeout: 10, fetch });
    await expect(client.get("cdn/stories", { version: "draft" })).rejects.toMatchObject({
      message: "Fetch failed",
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
