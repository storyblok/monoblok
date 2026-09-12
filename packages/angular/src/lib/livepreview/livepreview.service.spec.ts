import { NgZone } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { vi } from "vitest";
import {
  LivePreviewService,
  LivePreviewNotEnabledError,
  LIVE_PREVIEW_ENABLED,
  LIVE_PREVIEW_CONFIG,
} from "./livepreview.service";

// ---- mocks ----

const onStoryblokEditorEventMock = vi.fn(
  async (_cb: (story: unknown) => void, _config?: unknown): Promise<() => void> =>
    () => {},
);

vi.mock("@storyblok/live-preview", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onStoryblokEditorEvent: (cb: any, config: any) => onStoryblokEditorEventMock(cb, config),
}));

describe("LivePreviewService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("without live preview enabled", () => {
    let service: LivePreviewService;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [LivePreviewService] });
      service = TestBed.inject(LivePreviewService);
    });

    it("should be created", () => {
      expect(service).toBeTruthy();
    });

    it("throws LivePreviewNotEnabledError when listen() is called in dev mode", async () => {
      await expect(service.listen(() => {})).rejects.toThrow(LivePreviewNotEnabledError);
    });
  });

  describe("with live preview enabled", () => {
    let service: LivePreviewService;

    const baseConfig = { resolveLinks: "url" as const };

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          LivePreviewService,
          { provide: LIVE_PREVIEW_ENABLED, useValue: true },
          { provide: LIVE_PREVIEW_CONFIG, useValue: baseConfig },
        ],
      });
      service = TestBed.inject(LivePreviewService);
    });

    it("should be created", () => {
      expect(service).toBeTruthy();
    });

    it("passes merged config to onStoryblokEditorEvent", async () => {
      const pageConfig = { resolveRelations: ["featured-articles.articles"] };
      await service.listen(() => {}, pageConfig);

      expect(onStoryblokEditorEventMock).toHaveBeenCalledWith(expect.any(Function), {
        ...baseConfig,
        ...pageConfig,
      });
    });

    it("creates a separate subscription per listen() call", async () => {
      await service.listen(() => {}, { resolveRelations: ["a.b"] });
      await service.listen(() => {}, { resolveRelations: ["c.d"] });

      expect(onStoryblokEditorEventMock).toHaveBeenCalledTimes(2);
      expect(onStoryblokEditorEventMock).toHaveBeenNthCalledWith(1, expect.any(Function), {
        ...baseConfig,
        resolveRelations: ["a.b"],
      });
      expect(onStoryblokEditorEventMock).toHaveBeenNthCalledWith(2, expect.any(Function), {
        ...baseConfig,
        resolveRelations: ["c.d"],
      });
    });

    it("wraps the callback in NgZone.run()", async () => {
      await service.listen(() => {});

      const wrappedCallback = onStoryblokEditorEventMock.mock.calls[0][0];
      const ngZone = TestBed.inject(NgZone);
      const runSpy = vi.spyOn(ngZone, "run");

      wrappedCallback({ id: 1 });

      expect(runSpy).toHaveBeenCalledOnce();
    });

    it("returns the cleanup from onStoryblokEditorEvent", async () => {
      const cleanup = vi.fn();
      onStoryblokEditorEventMock.mockResolvedValueOnce(cleanup);

      const result = await service.listen(() => {});

      expect(result).toBe(cleanup);
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
