import { describe, expect, it } from "vitest";
import { mergeDeep } from "./object";

describe("mergeDeep", () => {
  it("should merge nested objects into the target", () => {
    const target = { a: 1, nested: { keep: true } };

    const result = mergeDeep(target, { b: 2, nested: { added: "yes" } });

    expect(result).toEqual({ a: 1, b: 2, nested: { keep: true, added: "yes" } });
  });

  it("should overwrite scalar values", () => {
    expect(mergeDeep({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("should return the target unchanged when the source is not a plain object", () => {
    expect(mergeDeep({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it("should not pollute Object.prototype via __proto__", () => {
    mergeDeep({}, JSON.parse('{"__proto__": {"polluted": "yes"}}'));

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("should not pollute Object.prototype via constructor.prototype", () => {
    mergeDeep({}, JSON.parse('{"constructor": {"prototype": {"polluted": "yes"}}}'));

    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
