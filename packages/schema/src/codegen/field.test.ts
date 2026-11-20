import { describe, expect, it } from "vitest";

import { stripKeys } from "./field";

describe("stripKeys", () => {
  it("should strip specified keys", () => {
    const obj = { a: 1, b: 2, c: 3 };
    const result = stripKeys(obj, new Set(["b"]));
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it("should remove undefined and null values", () => {
    const obj = { a: 1, b: undefined, c: null, d: "ok" };
    const result = stripKeys(obj, new Set());
    expect(result).toEqual({ a: 1, d: "ok" });
  });

  it("should preserve non-stripped keys with valid values", () => {
    const obj = { keep: "yes", strip: "no", also_keep: 0, falsy: false };
    const result = stripKeys(obj, new Set(["strip"]));
    expect(result).toEqual({ keep: "yes", also_keep: 0, falsy: false });
  });

  it("should return empty object when all keys are stripped", () => {
    const obj = { a: 1, b: 2 };
    const result = stripKeys(obj, new Set(["a", "b"]));
    expect(result).toEqual({});
  });
});
