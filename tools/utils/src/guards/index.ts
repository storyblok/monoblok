// Kept free of relative imports: openapi-codegen scripts load this module
// through Node's native type stripping, which cannot resolve extensionless paths.

export type UnknownRecord = Record<string, unknown>;

/** Narrows to a non-null, non-array object whose properties stay `unknown`. */
export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The value itself if it is a record, otherwise an empty one. */
export function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

/** The value itself if it is an array, otherwise an empty one. */
export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
