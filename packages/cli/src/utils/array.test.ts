import { describe, expect, it } from "vitest";
import { chunk, chunkByWeight } from "./array";

describe("chunk", () => {
  it("returns empty array for empty input", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("splits a set into batches of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single batch when input is smaller than size", () => {
    expect(chunk(["a", "b"], 10)).toEqual([["a", "b"]]);
  });

  it("accepts a Set (any Iterable)", () => {
    expect(chunk(new Set([1, 2, 3]), 2)).toEqual([[1, 2], [3]]);
  });

  it("returns a single batch when size is 0 or negative", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunk([1, 2, 3], -1)).toEqual([[1, 2, 3]]);
  });
});

describe("chunkByWeight", () => {
  const length = (item: string) => item.length;

  it("should return empty array for empty input", () => {
    expect(chunkByWeight([], { maxSize: 10, maxWeight: 10, weightOf: length })).toEqual([]);
  });

  it("should start a new batch when the next item would exceed the max weight", () => {
    expect(
      chunkByWeight(["aaa", "bb", "cccc", "d"], { maxSize: 10, maxWeight: 5, weightOf: length }),
    ).toEqual([
      ["aaa", "bb"],
      ["cccc", "d"],
    ]);
  });

  it("should start a new batch when the max size is reached", () => {
    expect(
      chunkByWeight(["a", "b", "c"], { maxSize: 2, maxWeight: 100, weightOf: length }),
    ).toEqual([["a", "b"], ["c"]]);
  });

  it("should put an item heavier than the max weight into its own batch", () => {
    expect(
      chunkByWeight(["a", "too-heavy", "b"], { maxSize: 10, maxWeight: 3, weightOf: length }),
    ).toEqual([["a"], ["too-heavy"], ["b"]]);
  });
});
