import { describe, expect, it } from "vitest";
import { slugify, slugifyPath } from ".";

describe("slugify", () => {
  it("should lowercase and replace spaces with dashes", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
  });

  it("should collapse repeated whitespace and dashes", () => {
    expect(slugify("Hello   World!!!   Test")).toBe("hello-world-test");
  });

  it("should strip non-word characters", () => {
    expect(slugify("Hello@World#123")).toBe("helloworld123");
  });

  it("should trim leading and trailing dashes", () => {
    expect(slugify("--Hero--")).toBe("hero");
  });
});

describe("slugifyPath", () => {
  it("should slugify each segment", () => {
    expect(slugifyPath("My Layout/Heros")).toBe("my-layout/heros");
  });

  it("should canonicalize casing and separator drift to the same value", () => {
    expect(slugifyPath("Layout/Heros")).toBe(slugifyPath("layout/heros"));
    expect(slugifyPath("My Layout")).toBe(slugifyPath("my-layout"));
  });

  it("should drop empty segments and trailing slashes", () => {
    expect(slugifyPath("Layout/")).toBe("layout");
    expect(slugifyPath("Layout//Heros")).toBe("layout/heros");
  });

  it("should strip non-word characters and collapse dashes", () => {
    expect(slugifyPath("Hero & Teaser")).toBe("hero-teaser");
  });

  it("should drop a segment that slugifies to empty instead of leaving a double slash", () => {
    expect(slugifyPath("Layout/&/Heros")).toBe("layout/heros");
    expect(slugifyPath("Layout/---/Heros")).toBe("layout/heros");
    expect(slugifyPath("A/&/B")).toBe("a/b");
  });

  it("should return an empty string for a path with no meaningful segments", () => {
    expect(slugifyPath("")).toBe("");
    expect(slugifyPath("/")).toBe("");
  });
});
