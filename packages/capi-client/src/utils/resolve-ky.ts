/**
 * `ky` is ESM-only. In the CJS build, `require("ky")` returns its module namespace, so the default import arrives as
 * an object whose `default` is the real function instead of the function itself. Returns a callable `ky` either way.
 */
export const resolveKy = <T>(mod: unknown): T =>
  (typeof mod === "function"
    ? mod
    : mod && typeof (mod as { default?: unknown }).default === "function"
      ? (mod as { default: unknown }).default
      : mod) as T;
