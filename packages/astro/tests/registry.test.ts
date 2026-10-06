import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveBlockComponent, setBlocks } from "../src/registry";

describe("registry", () => {
  afterEach(() => {
    setBlocks({ components: {} });
  });

  it("resolves a component registered for the block's type", () => {
    const Teaser = {};
    setBlocks({ components: { teaser: Teaser } });

    expect(resolveBlockComponent({ component: "teaser" })).toBe(Teaser);
  });

  it("falls back to the configured fallback when no component matches", () => {
    const Fallback = {};
    setBlocks({ components: {}, fallback: Fallback });

    expect(resolveBlockComponent({ component: "unknown" })).toBe(Fallback);
  });

  it("returns undefined and warns in dev when nothing matches and there is no fallback", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    setBlocks({ components: {} });

    expect(resolveBlockComponent({ component: "unknown" })).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"unknown"'));

    warn.mockRestore();
  });

  it("prefers a registered component over the fallback", () => {
    const Teaser = {};
    const Fallback = {};
    setBlocks({ components: { teaser: Teaser }, fallback: Fallback });

    expect(resolveBlockComponent({ component: "teaser" })).toBe(Teaser);
  });
});
