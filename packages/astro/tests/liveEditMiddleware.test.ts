import { describe, expect, it } from "vitest";
import { liveEditMiddleware } from "../src/live-preview/middleware";

const EDITOR_URL =
  "https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789";

function next() {
  return new Response(null);
}

describe("liveEditMiddleware", () => {
  it("captures the preview payload for an editor POST request", async () => {
    const story = { content: { component: "page" }, is_storyblok_preview: true };
    const request = new Request(EDITOR_URL, {
      method: "POST",
      body: JSON.stringify({ story }),
    });
    const locals: Record<string, unknown> = {};

    await liveEditMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toEqual({ story });
  });

  it("ignores POST requests that do not come from the editor", async () => {
    const request = new Request("https://example.com/", {
      method: "POST",
      body: JSON.stringify({ story: { is_storyblok_preview: true } }),
    });
    const locals: Record<string, unknown> = {};

    await liveEditMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toBeUndefined();
  });

  it("ignores GET requests", async () => {
    const request = new Request(EDITOR_URL, { method: "GET" });
    const locals: Record<string, unknown> = {};

    await liveEditMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toBeUndefined();
  });

  it("ignores editor POST requests without the preview marker", async () => {
    const request = new Request(EDITOR_URL, {
      method: "POST",
      body: JSON.stringify({ story: { content: {} } }),
    });
    const locals: Record<string, unknown> = {};

    await liveEditMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toBeUndefined();
  });
});
