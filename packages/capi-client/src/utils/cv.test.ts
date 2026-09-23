import { describe, expect, it } from "vitest";
import { applyCvToQuery, extractCv, extractSpaceVersion } from "./cv";

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
