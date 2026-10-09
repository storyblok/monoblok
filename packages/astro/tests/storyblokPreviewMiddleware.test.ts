import { describe, expect, it } from "vitest";
import { storyblokPreviewMiddleware } from "../src/live-preview/middleware";

const EDITOR_URL =
  "https://example.com/?_storyblok=123&_storyblok_c=456&_storyblok_tk[space_id]=789";

function next() {
  return Promise.resolve(new Response(null));
}

describe("storyblokPreviewMiddleware", () => {
  it("captures the preview payload for an editor POST request", async () => {
    const story = { content: { component: "page" }, is_storyblok_preview: true };
    const request = new Request(EDITOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story }),
    });
    const locals: Record<string, unknown> = {};

    await storyblokPreviewMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toEqual({ story });
  });

  it("ignores POST requests that do not come from the editor", async () => {
    const request = new Request("https://example.com/", {
      method: "POST",
      body: JSON.stringify({ story: { is_storyblok_preview: true } }),
    });
    const locals: Record<string, unknown> = {};

    await storyblokPreviewMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toBeUndefined();
  });

  it("ignores GET requests", async () => {
    const request = new Request(EDITOR_URL, { method: "GET" });
    const locals: Record<string, unknown> = {};

    await storyblokPreviewMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toBeUndefined();
  });

  it("ignores editor POST requests without the preview marker", async () => {
    const request = new Request(EDITOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story: { content: {} } }),
    });
    const locals: Record<string, unknown> = {};

    await storyblokPreviewMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toBeUndefined();
  });

  it("rejects a cross-site form POST forged with `Content-Type: text/plain`", async () => {
    // A plain HTML form can forge a cross-site POST (no CORS preflight) but
    // can only ever send `text/plain`, `multipart/form-data`, or
    // `application/x-www-form-urlencoded` — never `application/json`.
    const attackerStory = { content: { component: "page" }, is_storyblok_preview: true };
    const request = new Request(EDITOR_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ story: attackerStory }),
    });
    const locals: Record<string, unknown> = {};

    await storyblokPreviewMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toBeUndefined();
  });

  it("rejects a same-site-looking POST whose `Sec-Fetch-Site` says otherwise", async () => {
    const attackerStory = { content: { component: "page" }, is_storyblok_preview: true };
    const request = new Request(EDITOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" },
      body: JSON.stringify({ story: attackerStory }),
    });
    const locals: Record<string, unknown> = {};

    await storyblokPreviewMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toBeUndefined();
  });

  it("accepts a same-origin POST that sends `Sec-Fetch-Site: same-origin`", async () => {
    const story = { content: { component: "page" }, is_storyblok_preview: true };
    const request = new Request(EDITOR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Sec-Fetch-Site": "same-origin" },
      body: JSON.stringify({ story }),
    });
    const locals: Record<string, unknown> = {};

    await storyblokPreviewMiddleware({ locals, request } as any, next);

    expect(locals._storyblok_preview_data).toEqual({ story });
  });
});
