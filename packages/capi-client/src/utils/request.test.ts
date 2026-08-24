import { describe, expect, it } from "vitest";
import {
  createCacheKey,
  isDraftRequest,
  isSpacesMeRequest,
  normalizePath,
  shouldUseCache,
} from "./request";

describe("isDraftRequest", () => {
  it("should return true when version is draft", () => {
    expect(isDraftRequest({ version: "draft" })).toBe(true);
  });

  it("should return false when version is published", () => {
    expect(isDraftRequest({ version: "published" })).toBe(false);
  });

  it("should return false when version is absent", () => {
    expect(isDraftRequest({})).toBe(false);
  });
});

describe("createCacheKey", () => {
  it("should produce consistent key for same inputs", () => {
    const first = createCacheKey("GET", "/v2/cdn/stories", { a: 1, b: 2 }, "tid");
    const second = createCacheKey("GET", "/v2/cdn/stories", { b: 2, a: 1 }, "tid");

    expect(first).toBe(second);
  });

  it("should produce different keys for different methods", () => {
    const getKey = createCacheKey("GET", "/v2/cdn/stories", { a: 1 }, "tid");
    const postKey = createCacheKey("POST", "/v2/cdn/stories", { a: 1 }, "tid");

    expect(getKey).not.toBe(postKey);
  });

  it("should produce different keys for different paths", () => {
    const first = createCacheKey("GET", "/v2/cdn/stories", { a: 1 }, "tid");
    const second = createCacheKey("GET", "/v2/cdn/links", { a: 1 }, "tid");

    expect(first).not.toBe(second);
  });

  it("should produce the same key regardless of leading slash", () => {
    const withSlash = createCacheKey("GET", "/v2/cdn/stories", { version: "published" }, "tid");
    const withoutSlash = createCacheKey("GET", "v2/cdn/stories", { version: "published" }, "tid");

    expect(withSlash).toBe(withoutSlash);
  });

  it("should handle nested objects with sorted keys", () => {
    const first = createCacheKey(
      "GET",
      "/v2/cdn/stories",
      {
        filter_query: {
          author: {
            in: "a,b",
          },
        },
        sort_by: "name:asc",
      },
      "tid",
    );
    const second = createCacheKey(
      "GET",
      "/v2/cdn/stories",
      {
        sort_by: "name:asc",
        filter_query: {
          author: {
            in: "a,b",
          },
        },
      },
      "tid",
    );

    expect(first).toBe(second);
  });
});

describe("createCacheKey token scoping", () => {
  it("should produce different keys for different tokens", () => {
    // The token selects the space and travels outside `query`, so two clients sharing one
    // provider would otherwise read each other's content.
    expect(createCacheKey("GET", "/v2/cdn/stories", { version: "published" }, "tid-a")).not.toBe(
      createCacheKey("GET", "/v2/cdn/stories", { version: "published" }, "tid-b"),
    );
  });
});

describe("shouldUseCache", () => {
  it("should return true for GET published request", () => {
    expect(shouldUseCache("GET", "/v2/cdn/stories", { version: "published" })).toBe(true);
  });

  it("should return false for non-GET methods", () => {
    expect(shouldUseCache("POST", "/v2/cdn/stories", { version: "published" })).toBe(false);
  });

  it("should return false for draft requests", () => {
    expect(shouldUseCache("GET", "/v2/cdn/stories", { version: "draft" })).toBe(false);
  });

  it("should return false for non-cacheable paths", () => {
    expect(shouldUseCache("GET", "/v2/cdn/spaces/me", { version: "published" })).toBe(false);
  });

  it("should return false for non-cacheable paths without leading slash", () => {
    expect(shouldUseCache("GET", "v2/cdn/spaces/me", { version: "published" })).toBe(false);
  });
});

describe("normalizePath", () => {
  it("should add a missing leading slash", () => {
    expect(normalizePath("v2/cdn/stories")).toBe("/v2/cdn/stories");
  });

  it("should collapse repeated leading slashes", () => {
    expect(normalizePath("///v2/cdn/stories")).toBe("/v2/cdn/stories");
  });

  it("should drop trailing slashes", () => {
    expect(normalizePath("/v2/cdn/spaces/me/")).toBe("/v2/cdn/spaces/me");
    expect(normalizePath("v2/cdn/spaces/me//")).toBe("/v2/cdn/spaces/me");
  });

  it("should keep the root path", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
  });
});

describe("isSpacesMeRequest", () => {
  it("should match every spelling the API serves", () => {
    expect(isSpacesMeRequest("/v2/cdn/spaces/me")).toBe(true);
    expect(isSpacesMeRequest("v2/cdn/spaces/me")).toBe(true);
    expect(isSpacesMeRequest("/v2/cdn/spaces/me/")).toBe(true);
  });

  it("should not match another endpoint", () => {
    expect(isSpacesMeRequest("/v2/cdn/stories")).toBe(false);
  });
});

describe("shouldUseCache with a trailing slash", () => {
  it("should keep the spaces endpoint out of the cache", () => {
    expect(shouldUseCache("GET", "/v2/cdn/spaces/me/", {})).toBe(false);
  });
});

describe("createCacheKey with a trailing slash", () => {
  it("should produce the same key regardless of a trailing slash", () => {
    expect(createCacheKey("GET", "/v2/cdn/stories/", { version: "published" }, "tid")).toBe(
      createCacheKey("GET", "/v2/cdn/stories", { version: "published" }, "tid"),
    );
  });
});
