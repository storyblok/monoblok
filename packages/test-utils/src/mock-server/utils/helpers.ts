import assert from "node:assert";
import merge from "lodash.merge";

/**
 * Returns a new object with all own enumerable string keys transformed to lower case.
 *
 * @param obj - Source object whose keys will be lower-cased (defaults to an empty object).
 * @returns A shallow copy of the source object with lower-cased keys.
 */
export const toLowerCaseKeys = (obj = {}) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));

/**
 * Performs a deep equality check between two values.
 *
 * @param a - The first value to compare.
 * @param b - The second value to compare.
 * @returns `true` if the values are deeply and strictly equal, otherwise `false`.
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch (error) {
    return false;
  }
};

const isPlainObject = (val: unknown): val is Record<string, unknown> =>
  !!val && typeof val === "object" && !Array.isArray(val);

/**
 * Checks if the `subset` object is a subset of the `actual` object. The `actual` object/array can
 * have more properties/elements than the `subset` object/array.
 *
 * This means that for `deepSubset` to return `true`, all properties (including nested ones)
 * present in the `subset` object must also be present in the `actual` object with the same values.
 *
 * @param actual - The object to be checked against (the superset).
 * @param subset - The object that is expected to be a subset of `actual`.
 * @returns `true` if `subset` is a deep subset of `actual`, otherwise `false`.
 */
export const deepSubset = (actual: unknown, subset: unknown): boolean => {
  if (subset === undefined) return true;
  if (subset === null) return actual === null;
  if (typeof subset !== "object") return deepEqual(actual, subset);

  if (Array.isArray(subset)) {
    if (!Array.isArray(actual)) return false;
    // Conservative: subset must match by index where provided
    if (subset.length > actual.length) return false;
    for (let i = 0; i < subset.length; i++) {
      if (!deepSubset(actual[i], subset[i])) return false;
    }
    return true;
  }

  if (isPlainObject(subset) && isPlainObject(actual)) {
    for (const k of Object.keys(subset)) {
      if (!(k in actual)) return false;
      if (!deepSubset(actual[k], subset[k])) return false;
    }
    return true;
  }

  return false;
};

/**
 * Deeply merges two values with properties from overrides taking precedence over those in base.
 *
 * @param base - The initial value to be merged into.
 * @param overrides - The value providing overriding properties.
 * @returns The recursively merged result.
 */
export const deepMerge = (base: unknown, overrides: unknown) => {
  return merge(base, overrides);
};

/**
 * Counts the number of primitive leaf nodes within a nested data structure.
 *
 * A "leaf node" is defined as any non-object, non-array value (including: string,
 * number, boolean, bigint, symbol, null, undefined). Objects and arrays are
 * recursively traversed; their contained values are examined until primitives
 * (or null / undefined) are reached.
 *
 * @param obj - Any value (object, array, primitive) to inspect.
 * @returns The total count of primitive leaf nodes contained within the structure.
 */
export const countLeafNodes = (obj: unknown) => {
  if (obj === null || obj === undefined) return 0;
  if (typeof obj !== "object") return 1;
  if (Array.isArray(obj))
    return obj.reduce((acc, v) => acc + countLeafNodes(v), 0);
  return Object.values(obj).reduce((acc, v) => acc + countLeafNodes(v), 0);
};
