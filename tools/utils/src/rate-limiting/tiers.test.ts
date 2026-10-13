import { describe, expect, it } from "vitest";
import { determineRateLimitTier } from "./tiers";

describe("determineRateLimitTier()", () => {
  it("should return SINGLE_OR_SMALL for a single story path", () => {
    expect(determineRateLimitTier("/v2/cdn/stories/my-story", {})).toBe("SINGLE_OR_SMALL");
    // Nested slugs — per_page > 25 is supplied to confirm it's the regex, not the per_page default.
    expect(determineRateLimitTier("/v2/cdn/stories/folder/nested-story", { per_page: 100 })).toBe(
      "SINGLE_OR_SMALL",
    );
  });

  it("should return SINGLE_OR_SMALL when per_page is absent (default 25)", () => {
    expect(determineRateLimitTier("/v2/cdn/stories", {})).toBe("SINGLE_OR_SMALL");
  });

  it("should return SINGLE_OR_SMALL for per_page ≤ 25", () => {
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 1 })).toBe("SINGLE_OR_SMALL");
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 25 })).toBe("SINGLE_OR_SMALL");
  });

  it("should return MEDIUM for per_page 26–50", () => {
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 26 })).toBe("MEDIUM");
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 50 })).toBe("MEDIUM");
  });

  it("should return LARGE for per_page 51–75", () => {
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 51 })).toBe("LARGE");
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 75 })).toBe("LARGE");
  });

  it("should return VERY_LARGE for per_page > 75", () => {
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 76 })).toBe("VERY_LARGE");
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 100 })).toBe("VERY_LARGE");
  });

  it("should parse per_page when provided as a string", () => {
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: "26" })).toBe("MEDIUM");
  });

  it("should fall back to SINGLE_OR_SMALL for an unparseable per_page string", () => {
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: "invalid" })).toBe(
      "SINGLE_OR_SMALL",
    );
  });

  it("should not treat /v2/cdn/stories (no trailing identifier) as single story", () => {
    expect(determineRateLimitTier("/v2/cdn/stories", {})).toBe("SINGLE_OR_SMALL");
    // Still SINGLE_OR_SMALL here because per_page defaults to 25, but it's
    // because of per_page, not single-story detection.
    expect(determineRateLimitTier("/v2/cdn/stories", { per_page: 50 })).toBe("MEDIUM");
  });

  it("should work for non-story paths (links, tags, etc.)", () => {
    expect(determineRateLimitTier("/v2/cdn/links", { per_page: 100 })).toBe("VERY_LARGE");
    expect(determineRateLimitTier("/v2/cdn/tags", {})).toBe("SINGLE_OR_SMALL");
  });

  it("should detect a single story path without the API version prefix", () => {
    expect(determineRateLimitTier("/cdn/stories/my-story", { per_page: 100 })).toBe(
      "SINGLE_OR_SMALL",
    );
  });

  it("should treat a find_by request as a single story fetch", () => {
    expect(determineRateLimitTier("/cdn/stories", { find_by: "uuid", per_page: 100 })).toBe(
      "SINGLE_OR_SMALL",
    );
  });
});
