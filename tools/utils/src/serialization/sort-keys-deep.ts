/**
 * Returns a copy of `value` with the keys of every nested object sorted, so
 * that serializing it does not depend on the order the keys were added in.
 * Arrays keep their order, which is part of the value.
 */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value !== null && typeof value === "object") {
    // Not assignment: assigning `__proto__` sets the prototype and drops the key.
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }

  return value;
}
