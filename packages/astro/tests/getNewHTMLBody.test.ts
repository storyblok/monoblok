// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { getNewHTMLBody } from "../src/live-preview/get-new-html-body";

const story = { id: 1, content: { component: "page", _uid: "1" } };
const PRERENDER_HINT = "If this route is prerendered";

const respondWith = (status: number, statusText = "") => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status, statusText })));
};

describe("getNewHTMLBody", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return the parsed body of the re-rendered page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<main>Updated</main>", { status: 200 })),
    );

    const body = await getNewHTMLBody(story, new AbortController().signal);

    expect(body.innerHTML).toBe("<main>Updated</main>");
  });

  it.each([404, 405])(
    "should suggest on-demand rendering for a %i, which a prerendered route returns",
    async (status) => {
      respondWith(status);

      await expect(getNewHTMLBody(story, new AbortController().signal)).rejects.toThrow(
        PRERENDER_HINT,
      );
    },
  );

  it("should not suggest on-demand rendering when the render itself fails", async () => {
    respondWith(500, "Internal Server Error");

    const error = await getNewHTMLBody(story, new AbortController().signal).catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain("[storyblok] Failed to fetch updated HTML: 500");
    expect(String(error)).not.toContain(PRERENDER_HINT);
  });
});
