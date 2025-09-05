/**
 * Ensures the given path has a `.astro` extension.
 * If it already ends with `.astro`, returns as is.
 */
export function normalizeAstroExtension(path: string): string {
  return path.endsWith('.astro') ? path : `${path}.astro`;
}
