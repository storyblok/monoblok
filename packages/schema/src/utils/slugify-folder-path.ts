/**
 * Canonicalizes a folder display path (`'My Layout/Heros'`) to its slug-space
 * identity (`'my-layout/heros'`) by slugifying each `/` segment and dropping
 * empty segments. The validators use it so a folder referenced two ways (a
 * `defineFolder` ref vs. a string shorthand with different casing or separators)
 * resolves to the same folder — matching how the CLI/editor group it.
 *
 * The per-segment slug rule is identical to the `storyblok` CLI's `slugify`
 * (used by its `slugifyPath` for folder-path identity). The two live in separate
 * packages (the CLI has no runtime dependency on `@storyblok/schema`) but must
 * stay in sync; both are locked by golden-case tests.
 */
export function slugifyFolderPath(displayPath: string): string {
  return displayPath
    .split('/')
    .map(segment =>
      segment
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-') // spaces → single dash
        .replace(/[^\w-]+/g, '') // drop non-word chars
        .replace(/-{2,}/g, '-') // collapse repeated dashes
        .replace(/^-+/, '') // trim leading dashes
        .replace(/-+$/, ''), // trim trailing dashes
    )
    .filter(Boolean)
    .join('/');
}
