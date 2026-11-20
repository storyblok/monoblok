import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ISbStoryData } from "@storyblok/js";
import { liveEditUpdateAction } from "../rsc/live-edit-update-action";
import { PREVIEW_TOKEN_ENV_VAR, setPreviewAccessToken } from "../core/state";

const PREVIEW_TOKEN = "preview-token-abc";
const SPACE_ID = "12345";

const makeEditorToken = (
  previewToken = PREVIEW_TOKEN,
  timestamp = String(Math.floor(Date.now() / 1000)),
) => ({
  spaceId: SPACE_ID,
  timestamp,
  token: createHash("sha1").update(`${SPACE_ID}:${previewToken}:${timestamp}`).digest("hex"),
});

const story = (overrides: Partial<ISbStoryData> = {}): ISbStoryData => ({
  alternates: [],
  content: { _uid: "uid", component: "page" },
  created_at: "",
  full_slug: "home",
  group_id: "",
  id: 1,
  is_startpage: false,
  meta_data: {},
  name: "Home",
  parent_id: null,
  position: 0,
  published_at: null,
  first_published_at: null,
  slug: "home",
  sort_by_date: null,
  tag_list: [],
  uuid: "uuid",
  ...overrides,
});

/** Simulates a client sending a malformed payload, bypassing the TypeScript signature. */
const callUntyped = (payload: unknown): Promise<unknown> =>
  Reflect.apply(liveEditUpdateAction, undefined, [payload]);

describe("liveEditUpdateAction", () => {
  const mockRevalidatePath = vi.fn();
  let originalNextRuntime: string | undefined;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    globalThis.storyCache = new Map();
    setPreviewAccessToken(PREVIEW_TOKEN);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    originalNextRuntime = process.env.NEXT_RUNTIME;
    mockRevalidatePath.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalNextRuntime;
    consoleErrorSpy.mockRestore();
    setPreviewAccessToken(null);
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock("next/cache");
  });

  it.each([
    ["no story", { story: null, pathToRevalidate: "/path" }],
    ["no path", { story: story(), pathToRevalidate: null }],
    ["story without numeric id", { story: { uuid: "x" }, pathToRevalidate: "/path" }],
    ["relative path", { story: story(), pathToRevalidate: "victim" }],
    ["protocol-relative path", { story: story(), pathToRevalidate: "//evil.example" }],
    ["absolute URL", { story: story(), pathToRevalidate: "https://evil.example/" }],
  ])("rejects an invalid request (%s)", async (_label, payload) => {
    const result = await callUntyped({ ...payload, editorToken: makeEditorToken() });

    expect(result).toEqual({ ok: false, reason: "invalid-request" });
    expect(globalThis.storyCache.size).toBe(0);
  });

  describe("authorization", () => {
    it("rejects calls without an editor token", async () => {
      const result = await liveEditUpdateAction({ story: story(), pathToRevalidate: "/victim" });

      expect(result).toEqual({ ok: false, reason: "malformed" });
      expect(globalThis.storyCache.size).toBe(0);
    });

    it("rejects a forged editor token with an actionable message", async () => {
      const result = await liveEditUpdateAction({
        story: story(),
        pathToRevalidate: "/victim",
        editorToken: makeEditorToken("wrong-token"),
      });

      expect(result).toEqual({ ok: false, reason: "mismatch" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("first preview access token"),
      );
      expect(globalThis.storyCache.size).toBe(0);
    });

    it("rejects an expired editor token and tells the editor to reload", async () => {
      const twoHoursAgo = String(Math.floor(Date.now() / 1000) - 2 * 60 * 60);
      const result = await liveEditUpdateAction({
        story: story(),
        pathToRevalidate: "/victim",
        editorToken: makeEditorToken(PREVIEW_TOKEN, twoHoursAgo),
      });

      expect(result).toEqual({ ok: false, reason: "expired" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Reload the story"));
      expect(globalThis.storyCache.size).toBe(0);
    });

    it("rejects calls when no access token is configured on the server", async () => {
      setPreviewAccessToken(null);
      const result = await liveEditUpdateAction({
        story: story(),
        pathToRevalidate: "/victim",
        editorToken: makeEditorToken(),
      });

      expect(result).toEqual({ ok: false, reason: "no-server-token" });
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(PREVIEW_TOKEN_ENV_VAR));
      expect(globalThis.storyCache.size).toBe(0);
    });

    it("does not revalidate when the token is rejected", async () => {
      process.env.NEXT_RUNTIME = "nodejs";
      vi.doMock("next/cache", async () => ({ revalidatePath: mockRevalidatePath }));
      const { liveEditUpdateAction: actionWithMocks } =
        await import("../rsc/live-edit-update-action");

      await actionWithMocks({
        story: story(),
        pathToRevalidate: "/victim",
        editorToken: makeEditorToken("wrong-token"),
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("server token sources", () => {
    it(`accepts requests with only ${PREVIEW_TOKEN_ENV_VAR} set (static pages, cold starts)`, async () => {
      setPreviewAccessToken(null);
      vi.stubEnv(PREVIEW_TOKEN_ENV_VAR, PREVIEW_TOKEN);

      const result = await liveEditUpdateAction({
        story: story({ id: 5 }),
        pathToRevalidate: "/path",
        editorToken: makeEditorToken(),
      });

      expect(result).toEqual({ ok: true });
      expect(globalThis.storyCache.has("5")).toBe(true);
    });

    it("accepts the env token when storyblokInit was given a different (public) token", async () => {
      setPreviewAccessToken("public-token");
      vi.stubEnv(PREVIEW_TOKEN_ENV_VAR, PREVIEW_TOKEN);

      const result = await liveEditUpdateAction({
        story: story(),
        pathToRevalidate: "/path",
        editorToken: makeEditorToken(),
      });

      expect(result).toEqual({ ok: true });
    });

    it("sees a token set from another module instance (webpack server action layer)", async () => {
      // Each `resetModules` + import simulates a separate bundle layer with its own module copy.
      vi.resetModules();
      const { setPreviewAccessToken: setFromRscLayer } = await import("../core/state");
      setPreviewAccessToken(null);
      setFromRscLayer(PREVIEW_TOKEN);
      vi.resetModules();
      const { liveEditUpdateAction: actionFromOtherLayer } =
        await import("../rsc/live-edit-update-action");

      const result = await actionFromOtherLayer({
        story: story(),
        pathToRevalidate: "/path",
        editorToken: makeEditorToken(),
      });

      expect(result).toEqual({ ok: true });
    });
  });

  it("stores the story in the global storyCache", async () => {
    const updated = story({ id: 123 });
    const result = await liveEditUpdateAction({
      story: updated,
      pathToRevalidate: "/path",
      editorToken: makeEditorToken(),
    });

    expect(result).toEqual({ ok: true });
    expect(globalThis.storyCache.get("123")).toBe(updated);
  });

  it("replaces an existing story in the cache", async () => {
    const newStory = story({ id: 123, content: { _uid: "new", component: "page" } });
    globalThis.storyCache.set("123", story({ id: 123 }));

    await liveEditUpdateAction({
      story: newStory,
      pathToRevalidate: "/path",
      editorToken: makeEditorToken(),
    });
    expect(globalThis.storyCache.get("123")).toBe(newStory);
  });

  it("revalidates the path in a Next.js environment", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("next/cache", async () => ({ revalidatePath: mockRevalidatePath }));
    const { liveEditUpdateAction: actionWithMocks } =
      await import("../rsc/live-edit-update-action");

    const updated = story({ id: 7 });
    await actionWithMocks({
      story: updated,
      pathToRevalidate: "/test-path",
      editorToken: makeEditorToken(),
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/test-path");
    expect(globalThis.storyCache.get("7")).toBe(updated);
  });

  it("catches and logs errors during revalidation", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("next/cache", async () => ({
      revalidatePath: vi.fn(() => {
        throw new Error("Revalidation failed");
      }),
    }));
    const { liveEditUpdateAction: actionWithMocks } =
      await import("../rsc/live-edit-update-action");

    const updated = story({ id: 456 });
    const result = await actionWithMocks({
      story: updated,
      pathToRevalidate: "/path",
      editorToken: makeEditorToken(),
    });

    expect(result).toEqual({ ok: true });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "liveEditUpdateAction: error while revalidating path",
      expect.any(Error),
    );
    expect(globalThis.storyCache.get("456")).toBe(updated);
  });
});
