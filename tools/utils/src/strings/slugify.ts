/** Lowercases `text` and reduces it to `[a-z0-9_-]`, with spaces turned into single dashes. */
export const slugify = (text: string): string =>
  text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");

/**
 * Canonicalizes a folder display path (`'My Layout/Heros'`) to its slug-space
 * identity (`'my-layout/heros'`), so a folder referenced with different casing
 * or separators resolves to the same folder. Segments are filtered after
 * slugifying, so one that reduces to empty is dropped instead of leaving a
 * double slash (`'A/&/B'` → `'a/b'`).
 */
export const slugifyPath = (displayPath: string): string =>
  displayPath
    .split("/")
    .map((segment) => slugify(segment))
    .filter(Boolean)
    .join("/");
