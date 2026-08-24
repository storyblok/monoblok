import { TestBed } from "@angular/core/testing";
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  LivePreviewService,
  LivePreviewNotEnabledError,
  LIVE_PREVIEW_ENABLED,
  LIVE_PREVIEW_CONFIG,
} from "./livepreview.service";

// ---- mock @storyblok/live-preview ----

const onStoryblokEditorEventMock = vi.hoisted(() => vi.fn());

vi.mock("@storyblok/live-preview", () => ({
  onStoryblokEditorEvent: onStoryblokEditorEventMock,
}));

describe("LivePreviewService", () => {
  describe("without live preview enabled", () => {
    let service: LivePreviewService;

    beforeEach(() => {
      vi.clearAllMocks();
      TestBed.configureTestingModule({
        providers: [LivePreviewService],
      });
      service = TestBed.inject(LivePreviewService);
    });

    it("should be created", () => {
      expect(service).toBeTruthy();
    });

    it("should throw LivePreviewNotEnabledError when listen() is called in dev mode", async () => {
      await expect(service.listen(() => {})).rejects.toThrow(LivePreviewNotEnabledError);
    });

    it("does not call onStoryblokEditorEvent when not enabled", async () => {
      try {
        await service.listen(() => {});
      } catch {
        // expected
      }
      expect(onStoryblokEditorEventMock).not.toHaveBeenCalled();
    });
  });

  describe("with live preview enabled", () => {
    let service: LivePreviewService;
    const cleanupMock = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
      onStoryblokEditorEventMock.mockResolvedValue(cleanupMock);

      TestBed.configureTestingModule({
        providers: [
          LivePreviewService,
          { provide: LIVE_PREVIEW_ENABLED, useValue: true },
          { provide: LIVE_PREVIEW_CONFIG, useValue: {} },
        ],
      });
      service = TestBed.inject(LivePreviewService);
    });

    it("should be created", () => {
      expect(service).toBeTruthy();
    });

    it("calls onStoryblokEditorEvent when listen() is called", async () => {
      await service.listen(() => {});
      expect(onStoryblokEditorEventMock).toHaveBeenCalledOnce();
    });

    it("passes merged config (base + per-call) to onStoryblokEditorEvent", async () => {
      TestBed.resetTestingModule();
      onStoryblokEditorEventMock.mockResolvedValue(cleanupMock);

      TestBed.configureTestingModule({
        providers: [
          LivePreviewService,
          { provide: LIVE_PREVIEW_ENABLED, useValue: true },
          { provide: LIVE_PREVIEW_CONFIG, useValue: { resolveRelations: ["a.b"] } },
        ],
      });
      service = TestBed.inject(LivePreviewService);

      await service.listen(() => {}, { preventClicks: true });

      expect(onStoryblokEditorEventMock).toHaveBeenCalledWith(expect.any(Function), {
        resolveRelations: ["a.b"],
        preventClicks: true,
      });
    });

    it("per-call options override base config", async () => {
      TestBed.resetTestingModule();
      onStoryblokEditorEventMock.mockResolvedValue(cleanupMock);

      TestBed.configureTestingModule({
        providers: [
          LivePreviewService,
          { provide: LIVE_PREVIEW_ENABLED, useValue: true },
          { provide: LIVE_PREVIEW_CONFIG, useValue: { resolveRelations: ["a.b"] } },
        ],
      });
      service = TestBed.inject(LivePreviewService);

      await service.listen(() => {}, { resolveRelations: ["c.d"] });

      expect(onStoryblokEditorEventMock).toHaveBeenCalledWith(expect.any(Function), {
        resolveRelations: ["c.d"],
      });
    });

    it("returns the cleanup function from onStoryblokEditorEvent", async () => {
      const cleanup = await service.listen(() => {});
      expect(cleanup).toBe(cleanupMock);
    });

    it("invoking the returned cleanup calls the underlying bridge destroy", async () => {
      const cleanup = await service.listen(() => {});
      cleanup();
      expect(cleanupMock).toHaveBeenCalledOnce();
    });

    it("forwards story updates to the callback inside NgZone", async () => {
      const cb = vi.fn();
      await service.listen(cb);

      // Grab the inner callback passed to onStoryblokEditorEvent and invoke it
      const innerCb = onStoryblokEditorEventMock.mock.calls[0][0];
      const story = { id: 1, content: {} };
      innerCb(story);

      expect(cb).toHaveBeenCalledWith(story);
    });
  });
});

describe("LivePreviewNotEnabledError", () => {
  it("should have correct error name", () => {
    const error = new LivePreviewNotEnabledError();
    expect(error.name).toBe("LivePreviewNotEnabledError");
  });

  it("should have helpful error message", () => {
    const error = new LivePreviewNotEnabledError();
    expect(error.message).toContain("withLivePreview()");
    expect(error.message).toContain("provideStoryblok");
  });
});
