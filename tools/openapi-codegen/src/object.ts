/** A non-null, non-array object: a parsed spec node whose keys can be read and written. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
