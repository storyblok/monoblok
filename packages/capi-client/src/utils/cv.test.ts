import { describe, expect, it } from "vitest";
import { applyCvToQuery, extractCv, extractServedCv, extractSpaceVersion } from "./cv";

describe("extractCv", () => {
  it("should extract numeric cv from valid response", () => {
    expect(extractCv({ cv: 12_345 })).toBe(12_345);
  });

  it("should return undefined for string cv", () => {
    expect(extractCv({ cv: "12345" })).toBeUndefined();
  });

  it("should return undefined when cv is missing", () => {
    expect(extractCv({})).toBeUndefined();
  });

  it("should return undefined for non-object input", () => {
    expect(extractCv(null)).toBeUndefined();
    expect(extractCv(undefined)).toBeUndefined();
    expect(extractCv(42)).toBeUndefined();
  });
});

describe("extractServedCv", () => {
  const LINKS = { method: "GET", path: "/v2/cdn/links", query: {} };
  const respondedFrom = (url: string) => ({ data: { links: {} }, response: { url } });

  it("should read the cv of a published request's final URL", () => {
    expect(
      extractServedCv(respondedFrom("https://api.storyblok.com/v2/cdn/links?cv=2000"), LINKS),
    ).toBe(2000);
  });

  it("should read the last cv of the final URL, which the CDN serves", () => {
    expect(
      extractServedCv(
        respondedFrom("https://api.storyblok.com/v2/cdn/links?x&cv=9007199254740991&cv=2000"),
        LINKS,
      ),
    ).toBe(2000);
  });

  it("should prefer the cv the body reports", () => {
    const result = {
      data: { stories: [], cv: 3000 },
      response: { url: "https://api.storyblok.com/v2/cdn/stories?cv=2000" },
    };

    expect(extractServedCv(result, { ...LINKS, path: "/v2/cdn/stories" })).toBe(3000);
  });

  it("should ignore the URL of a draft request", () => {
    const result = respondedFrom("https://api.storyblok.com/v2/cdn/links?version=draft&cv=2000");

    expect(extractServedCv(result, { ...LINKS, query: { version: "draft" } })).toBeUndefined();
  });

  it("should ignore the URL of a space request", () => {
    const result = {
      data: { space: { version: 2000 } },
      response: { url: "https://api.storyblok.com/v2/cdn/spaces/me?cv=2000" },
    };

    expect(extractServedCv(result, { ...LINKS, path: "/v2/cdn/spaces/me" })).toBeUndefined();
  });

  it.each(["0", "-5", "1000.5", "1e20", "Infinity", "abc", ""])(
    "should ignore a URL cv of %j",
    (cv) => {
      const result = respondedFrom(`https://api.storyblok.com/v2/cdn/links?cv=${cv}`);

      expect(extractServedCv(result, LINKS)).toBeUndefined();
    },
  );

  it("should return undefined without a response URL", () => {
    expect(extractServedCv(respondedFrom(""), LINKS)).toBeUndefined();
    expect(extractServedCv({ data: { links: {} } }, LINKS)).toBeUndefined();
  });
});

describe("applyCvToQuery", () => {
  it("should append cv for published request", () => {
    expect(applyCvToQuery({ version: "published" }, 100)).toEqual({
      version: "published",
      cv: 100,
    });
  });

  it("should not append cv for draft requests", () => {
    const query = { version: "draft" };
    expect(applyCvToQuery(query, 100)).toBe(query);
  });

  it("should preserve user-provided cv", () => {
    expect(applyCvToQuery({ version: "published", cv: 999 }, 100)).toEqual({
      version: "published",
      cv: 999,
    });
  });
});

describe("extractSpaceVersion", () => {
  it("should extract the version from a spaces/me response", () => {
    expect(extractSpaceVersion({ space: { id: 1, version: 1_786_950_860 } })).toBe(1_786_950_860);
  });

  it("should return undefined when the space has no version", () => {
    expect(extractSpaceVersion({ space: { id: 1 } })).toBeUndefined();
  });

  it("should return undefined for a non-numeric version", () => {
    expect(extractSpaceVersion({ space: { version: "1786950860" } })).toBeUndefined();
  });

  it("should return undefined for responses without a space", () => {
    expect(extractSpaceVersion({ cv: 12_345 })).toBeUndefined();
    expect(extractSpaceVersion({ space: null })).toBeUndefined();
    expect(extractSpaceVersion(null)).toBeUndefined();
    expect(extractSpaceVersion(42)).toBeUndefined();
  });
});
