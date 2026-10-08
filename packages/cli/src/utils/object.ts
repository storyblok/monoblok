export type PlainObject = Record<string, any>;

export function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Prefer `isRecord` over `isPlainObject` when walking untyped input: the
// narrowed properties stay `unknown` instead of `any`, so they still have to be
// checked.
export { isRecord } from "@storyblok/utils/guards";

// `__proto__` and `constructor` are the two keys that reach Object.prototype
// from a plain merge target, so assigning either would change every object in
// the process. `prototype` reaches nothing on its own and is skipped only so a
// source cannot set up a later `constructor.prototype` walk.
const PROTOTYPE_POLLUTING_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function mergeDeep<T extends PlainObject>(target: T, source?: PlainObject): T {
  if (!isPlainObject(source)) {
    return target;
  }

  const targetRecord = target as PlainObject;

  for (const [key, value] of Object.entries(source)) {
    if (PROTOTYPE_POLLUTING_KEYS.has(key)) {
      continue;
    }
    if (isPlainObject(value)) {
      const existing = targetRecord[key];
      const base = isPlainObject(existing) ? existing : {};
      targetRecord[key] = mergeDeep(base, value);
    } else {
      targetRecord[key] = value;
    }
  }

  return target;
}

export function isEmptyObject(obj: object): boolean {
  return Object.keys(obj).length === 0;
}
