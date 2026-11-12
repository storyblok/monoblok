/**
 * Joins path segments with `/`, which every runtime's filesystem API accepts,
 * Windows included, so path handling needs no runtime-specific module.
 */
export function joinPath(...segments: string[]): string {
  return segments.map((segment) => segment.replace(/[\\/]+$/, "")).join("/");
}
