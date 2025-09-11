import { describe, it, expect } from "vitest";
import {
  toLowerCaseKeys,
  deepEqual,
  deepSubset,
  deepMerge,
  countLeafNodes,
} from "./helpers.ts";

describe("toLowerCaseKeys", () => {
  it("should lower-case all string keys", () => {
    const input = { Foo: 1, BAR: 2, BazQux: 3 };
    const result = toLowerCaseKeys(input);
    expect(result).toEqual({ foo: 1, bar: 2, bazqux: 3 });
  });

  it("should not mutate the original object", () => {
    const input = { Foo: 1 };
    const copy = { ...input };
    toLowerCaseKeys(input);
    expect(input).toEqual(copy);
  });

  it("should ignore symbol keys (not included in Object.entries)", () => {
    const sym = Symbol("s");
    const input = { Foo: 1, [sym]: 2 } as Record<string | symbol, number>;
    const result = toLowerCaseKeys(input);
    expect(result).toEqual({ foo: 1 });
    // Ensure symbol key not present and original still has it
    expect(Object.getOwnPropertySymbols(result).length).toBe(0);
    expect(Object.getOwnPropertySymbols(input)).toContain(sym);
  });
});

describe("deepEqual", () => {
  it("should return true for deeply equal primitives and objects", () => {
    expect(deepEqual(5, 5)).toBe(true);
    expect(
      deepEqual({ a: 1, b: { c: [1, 2, 3] } }, { a: 1, b: { c: [1, 2, 3] } })
    ).toBe(true);
  });

  it("should return false for different values", () => {
    expect(deepEqual(5, 6)).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("deepSubset", () => {
  it("should return true when subset is undefined", () => {
    expect(deepSubset({ a: 1 }, undefined)).toBe(true);
  });

  it("should handle null subset correctly", () => {
    expect(deepSubset(null, null)).toBe(true);
    expect(deepSubset({}, null)).toBe(false);
  });

  it("should match primitive subset", () => {
    expect(deepSubset(5, 5)).toBe(true);
    expect(deepSubset(5, 6)).toBe(false);
  });

  it("should validate object subset", () => {
    const actual = { a: 1, b: { c: 2, d: 3 }, e: 4 };
    const subset = { b: { c: 2 } };
    expect(deepSubset(actual, subset)).toBe(true);
  });

  it("should return false when a key is missing", () => {
    expect(deepSubset({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it("should validate array subset by index", () => {
    expect(deepSubset([1, 2, 3], [1, 2])).toBe(true);
    expect(deepSubset([1, 2, 3], [1, 2, 4])).toBe(false);
  });

  it("should validate nested arrays and objects", () => {
    const actual = [
      { id: 1, val: { x: 10 } },
      { id: 2, val: { x: 20, y: 30 } },
    ];
    const subset = [{ id: 1, val: { x: 10 } }];
    expect(deepSubset(actual, subset)).toBe(true);
  });

  it("should fail when subset array is longer", () => {
    expect(deepSubset([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe("deepMerge", () => {
  it("should deeply merge objects with overrides taking precedence", () => {
    const base: any = {
      a: 1,
      nested: { x: 1, y: 1 },
      list: [
        { id: 1, v: 1 },
        { id: 2, v: 2 },
      ],
    };
    const overrides = {
      a: 10,
      nested: { y: 2, z: 3 },
      list: [{ id: 1, v: 5 }],
      extra: "yes",
    };
    const result = deepMerge(base, overrides) as any;

    expect(result).toEqual({
      a: 10,
      nested: { x: 1, y: 2, z: 3 },
      list: [
        { id: 1, v: 5 },
        { id: 2, v: 2 },
      ],
      extra: "yes",
    });
  });

  it("should mutate the base object (lodash.merge behavior)", () => {
    const base: any = { a: 1, nested: { x: 1 } };
    const overrides = { nested: { y: 2 } };
    const result = deepMerge(base, overrides);
    expect(result).toBe(base);
    expect(base).toEqual({ a: 1, nested: { x: 1, y: 2 } });
  });
});

describe("countLeafNodes", () => {
  it("should return 1 for a primitive value", () => {
    expect(countLeafNodes(42)).toBe(1);
    expect(countLeafNodes("hello")).toBe(1);
  });

  it("should return 0 for null or undefined (current implementation)", () => {
    expect(countLeafNodes(null)).toBe(0);
    expect(countLeafNodes(undefined)).toBe(0);
  });

  it("should count leaf nodes in nested structures", () => {
    const obj = {
      a: 1,
      b: { c: 2, d: [3, { e: 4, f: null }, []], g: undefined },
      h: [],
      i: "x",
    };
    expect(countLeafNodes(obj)).toBe(5);
  });

  it("should count leaf nodes in arrays", () => {
    expect(countLeafNodes([1, [2, 3], null])).toBe(3);
  });
});
