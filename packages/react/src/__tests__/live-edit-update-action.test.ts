import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { liveEditUpdateAction } from "../rsc/live-edit-update-action";
import { setPreviewAccessToken } from "../core/state";

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

describe("liveEditUpdateAction", () => {
  const mockRevalidatePath = vi.fn();
  let originalNextRuntime: string | undefined;
  let consoleErrorSpy: any;

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
    vi.resetModules();
    vi.doUnmock("next/cache");
  });

  it("should log an error if story or pathToRevalidate is not provided", async () => {
    await liveEditUpdateAction({
      story: null,
      pathToRevalidate: "/path",
      editorToken: makeEditorToken(),
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "liveEditUpdateAction: story or pathToRevalidate is not provided",
    );

    await liveEditUpdateAction({
      story: { uuid: "123" } as any,
      pathToRevalidate: null,
      editorToken: makeEditorToken(),
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "liveEditUpdateAction: story or pathToRevalidate is not provided",
    );
  });

  describe("authorization", () => {
    it("rejects calls without an editor token", async () => {
      await liveEditUpdateAction({ story: { id: 1 } as any, pathToRevalidate: "/victim" });
      expect(globalThis.storyCache.size).toBe(0);
    });

    it("rejects a forged editor token", async () => {
      await liveEditUpdateAction({
        story: { id: 1 } as any,
        pathToRevalidate: "/victim",
        editorToken: makeEditorToken("wrong-token"),
      });
      expect(globalThis.storyCache.size).toBe(0);
    });

    it("rejects an expired editor token", async () => {
      const twoHoursAgo = String(Math.floor(Date.now() / 1000) - 2 * 60 * 60);
      await liveEditUpdateAction({
        story: { id: 1 } as any,
        pathToRevalidate: "/victim",
        editorToken: makeEditorToken(PREVIEW_TOKEN, twoHoursAgo),
      });
      expect(globalThis.storyCache.size).toBe(0);
    });

    it("rejects calls when no access token is configured on the server", async () => {
      setPreviewAccessToken(null);
      await liveEditUpdateAction({
        story: { id: 1 } as any,
        pathToRevalidate: "/victim",
        editorToken: makeEditorToken(),
      });
      expect(globalThis.storyCache.size).toBe(0);
    });

    it("does not revalidate when the token is rejected", async () => {
      process.env.NEXT_RUNTIME = "nodejs";
      vi.doMock("next/cache", async () => ({ revalidatePath: mockRevalidatePath }));
      const { liveEditUpdateAction: actionWithMocks } =
        await import("../rsc/live-edit-update-action");
      const { setPreviewAccessToken: setToken } = await import("../core/state");
      setToken(PREVIEW_TOKEN);

      await actionWithMocks({
        story: { id: 1 } as any,
        pathToRevalidate: "/victim",
        editorToken: makeEditorToken("wrong-token"),
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it.each(["victim", "//evil.example", "https://evil.example/"])(
      "rejects an invalid pathToRevalidate (%s)",
      async (pathToRevalidate) => {
        await liveEditUpdateAction({
          story: { id: 1 } as any,
          pathToRevalidate,
          editorToken: makeEditorToken(),
        });
        expect(globalThis.storyCache.size).toBe(0);
      },
    );
  });

  it("should set the story in the global storyCache", async () => {
    const story = { id: 123 } as any;
    await liveEditUpdateAction({
      story,
      pathToRevalidate: "/path",
      editorToken: makeEditorToken(),
    });
    expect(globalThis.storyCache.get("123")).toBe(story);
  });

  it("should replace existing story in the cache if it already exists", async () => {
    const oldStory = { id: 123, content: { old: true } } as any;
    const newStory = { id: 123, content: { new: true } } as any;

    globalThis.storyCache.set("123", oldStory);

    await liveEditUpdateAction({
      story: newStory,
      pathToRevalidate: "/path",
      editorToken: makeEditorToken(),
    });
    expect(globalThis.storyCache.get("123")).toBe(newStory);
  });

  it("should skip caching when story.id is missing", async () => {
    const story = { uuid: "uuid-only", content: {} } as any;
    await liveEditUpdateAction({
      story,
      pathToRevalidate: "/path",
      editorToken: makeEditorToken(),
    });
    expect(globalThis.storyCache.size).toBe(0);
    expect(globalThis.storyCache.has("undefined")).toBe(false);
  });

  it("should revalidate path when in Next.js environment", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("next/cache", async () => ({ revalidatePath: mockRevalidatePath }));

    const { liveEditUpdateAction: actionWithMocks } =
      await import("../rsc/live-edit-update-action");
    const { setPreviewAccessToken: setToken } = await import("../core/state");
    setToken(PREVIEW_TOKEN);

    const story = { id: 7, content: { headline: "history" } } as any;
    await actionWithMocks({
      story,
      pathToRevalidate: "/test-path",
      editorToken: makeEditorToken(),
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith("/test-path");
    expect(globalThis.storyCache.get("7")).toBe(story);
  });

  it("should catch and log errors during revalidation", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    vi.doMock("next/cache", async () => ({
      revalidatePath: vi.fn(() => {
        throw new Error("Revalidation failed");
      }),
    }));

    const { liveEditUpdateAction: actionWithMocks } =
      await import("../rsc/live-edit-update-action");
    const { setPreviewAccessToken: setToken } = await import("../core/state");
    setToken(PREVIEW_TOKEN);

    const story = { id: 456 } as any;
    await actionWithMocks({ story, pathToRevalidate: "/path", editorToken: makeEditorToken() });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "liveEditUpdateAction: error while revalidating path",
      expect.any(Error),
    );
    expect(globalThis.storyCache.get("456")).toBe(story);
  });
});
