import { describe, expect, it } from "vitest";
import { resolveHeadingTag } from "./dynamic-resolvers";

describe("resolveHeadingTag", () => {
  it("defaults to h1 when no level provided", () => {
    expect(resolveHeadingTag({})).toBe("h1");
  });

  it("returns valid heading level", () => {
    expect(resolveHeadingTag({ level: 1 })).toBe("h1");
    expect(resolveHeadingTag({ level: 3 })).toBe("h3");
    expect(resolveHeadingTag({ level: 6 })).toBe("h6");
  });

  it("clamps values above 6", () => {
    expect(resolveHeadingTag({ level: 7 })).toBe("h6");
    expect(resolveHeadingTag({ level: 100 })).toBe("h6");
  });

  it("clamps values below 1", () => {
    expect(resolveHeadingTag({ level: 0 })).toBe("h1");
    expect(resolveHeadingTag({ level: -5 })).toBe("h1");
  });

  it("handles undefined level", () => {
    expect(resolveHeadingTag({ level: undefined })).toBe("h1");
  });
});
