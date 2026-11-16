import { describe, expectTypeOf, it } from "vitest";
import type { LivePreviewListenOptions, StoryblokEditorChangeEvent } from "./public-api";

describe("public API", () => {
  it("should export the event type passed to onChange", () => {
    expectTypeOf<
      Parameters<NonNullable<LivePreviewListenOptions["onChange"]>>[0]
    >().toEqualTypeOf<StoryblokEditorChangeEvent>();
  });
});
