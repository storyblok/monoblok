export type PlainObject = Record<string, any>;

export function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function mergeDeep<T extends PlainObject>(target: T, source?: PlainObject): T {
  if (!isPlainObject(source)) {
    return target;
  }

  const targetRecord = target as PlainObject;

  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value)) {
      const existing = targetRecord[key];
      const base = isPlainObject(existing) ? existing : {};
      targetRecord[key] = mergeDeep(base, value);
    }
    else {
      targetRecord[key] = value;
    }
  }

  return target;
}

export function isEmptyObject(obj: object): boolean {
  return Object.keys(obj).length === 0;
}
