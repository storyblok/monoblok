import { describe, expect, it } from "vitest";
import { asArray, asRecord, isRecord } from ".";

describe("isRecord", () => {
  it("should accept plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("should reject null, arrays and primitives", () => {
    for (const value of [null, undefined, [], [1], "a", 0, true]) {
      expect(isRecord(value)).toBe(false);
    }
  });
});

describe("asRecord", () => {
  it("should return the same record", () => {
    const record = { a: 1 };
    expect(asRecord(record)).toBe(record);
  });

  it("should fall back to an empty record for anything else", () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord([1])).toEqual({});
    expect(asRecord("a")).toEqual({});
  });
});

describe("asArray", () => {
  it("should return the same array", () => {
    const array = [1];
    expect(asArray(array)).toBe(array);
  });

  it("should fall back to an empty array for anything else", () => {
    expect(asArray(undefined)).toEqual([]);
    expect(asArray({ length: 1 })).toEqual([]);
  });
});
