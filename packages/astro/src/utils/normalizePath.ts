/**
 * Normalizes a path string to a consistent format:
 * - Always starts with a single leading slash (`/`)
 * - Never ends with a trailing slash (except for root `/`)
 * - Collapses duplicate slashes inside the path
 *
 * @param p - The input path to normalize
 * @returns A normalized path string
 *
 * @example
 * normalizePath("components");       // "/components"
 * normalizePath("/components/");     // "/components"
 * normalizePath("//foo//bar///baz"); // "/foo/bar/baz"
 * normalizePath("/");                // "/"
 */
export function normalizePath(p: string): string {
  return (
    `/${
      p
        .trim()
        .replace(/^\/+/, '') // remove leading slashes
        .replace(/\/+$/, '') // remove trailing slashes
        .replace(/\/{2,}/g, '/')}` // collapse multiple slashes
  );
}
