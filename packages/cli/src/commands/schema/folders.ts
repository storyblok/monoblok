import type { ComponentFolder } from "../../types";
import { slugify } from "../../utils/format";
import { isRecord } from "./utils";
import type { LocalFolder } from "./types";

/**
 * `schema init` lays remote blocks out into local directories that mirror their
 * Storyblok component groups, purely for local organization — the directory
 * layout itself is cosmetic. Group membership is instead managed in code: a
 * block declares its folder via a `folder` key and `schema push` creates,
 * resolves, and (with `--delete`) removes the matching component groups. Group
 * names become slugified directory segments (e.g. `My Layout` → `my-layout`).
 */

/**
 * Builds a `component_group_uuid → slugified path segments` map from the remote
 * component groups, walking each group's `parent_uuid` chain. Used by
 * `schema init` to lay blocks out in nested group directories.
 */
export function buildGroupPathByUuid(folders: ComponentFolder[]): Map<string, string[]> {
  const byUuid = new Map(folders.map((folder) => [folder.uuid, folder]));
  const cache = new Map<string, string[]>();

  // `visited` tracks the groups in the current upward walk so a self-referential
  // (`parent_uuid === uuid`) or cyclic `parent_uuid` chain stops instead of
  // recursing forever. On a detected cycle the chain is cut and the group is
  // treated as a path root. (The `cache` can't guard this: it's only populated
  // after the recursive call returns, so it's empty while a cycle is unwinding.)
  function pathFor(uuid: string | null, visited: Set<string>): string[] {
    if (!uuid) {
      return [];
    }
    const cached = cache.get(uuid);
    if (cached) {
      return cached;
    }
    const folder = byUuid.get(uuid);
    if (!folder) {
      return [];
    }
    if (visited.has(uuid)) {
      return [];
    }
    visited.add(uuid);
    const path = [...pathFor(folder.parent_uuid, visited), slugify(folder.name)];
    cache.set(uuid, path);
    return path;
  }

  for (const folder of folders) {
    pathFor(folder.uuid, new Set());
  }
  return cache;
}

/**
 * Slugifies each `/` segment of a display path: `'My Layout/Heros'` →
 * `'my-layout/heros'`. Segments are dropped when they slugify to empty, so
 * `'Layout/'` → `'layout'` (not `'layout/'`) and `'A/&/B'` → `'a/b'` (the
 * symbol-only segment vanishes, not `'a//b'`).
 *
 * This is folder-path *identity*: a folder authored as a `defineFolder` ref or
 * as a string shorthand with different casing/separators must canonicalize to
 * the same value here and in `@storyblok/schema`'s `slugifyFolderPath`, which
 * the schema validators use. The two implementations share this algorithm (the
 * per-segment `slugify`, filtered *after* slugifying so a segment that reduces
 * to empty is dropped rather than left as a double slash) and are each locked by
 * golden-case tests; keep them in sync. (The CLI does not import the schema
 * helper to avoid a runtime dependency on `@storyblok/schema`.)
 */
export function slugifyPath(displayPath: string): string {
  return displayPath
    .split("/")
    .map((segment) => slugify(segment))
    .filter(Boolean)
    .join("/");
}

/**
 * The wire field keys holding component group references. Both the whitelist
 * (`allow`) and the denylist (`deny`) name groups, so anything translating
 * between the transient slug-path space and the server's uuid space has to walk
 * both — translating only the whitelist would leave a denylist pointing at slug
 * paths the API cannot resolve.
 */
export const GROUP_LIST_KEYS = ["component_group_whitelist", "component_group_denylist"] as const;

/**
 * Returns a copy of a wire `schema` record with every field's group list entries
 * (see {@link GROUP_LIST_KEYS}) passed through `mapEntry`. Fields carrying
 * neither key, and non-string entries, are copied through untouched; the source
 * objects are never mutated. An entry `mapEntry` cannot translate should be
 * returned as-is by the caller, so it still produces a visible diff or reaches
 * the API for the server to reject.
 */
export function mapSchemaGroupLists(schema: unknown, mapEntry: (entry: string) => string): unknown {
  if (!isRecord(schema)) {
    return schema;
  }
  const result: Record<string, unknown> = {};
  for (const [fieldName, field] of Object.entries(schema)) {
    if (!isRecord(field) || !GROUP_LIST_KEYS.some((key) => Array.isArray(field[key]))) {
      result[fieldName] = field;
      continue;
    }
    const mapped: Record<string, unknown> = { ...field };
    for (const key of GROUP_LIST_KEYS) {
      const list = field[key];
      if (Array.isArray(list)) {
        mapped[key] = list.map((entry) => (typeof entry === "string" ? mapEntry(entry) : entry));
      }
    }
    result[fieldName] = mapped;
  }
  return result;
}

/**
 * Expands a display path into one {@link LocalFolder} per prefix, parent-first.
 * `'Layout/Heros'` → Layout (root) then Heros (child). Paths are slug space;
 * names keep the display casing for group creation. Segments that slugify to
 * empty (blank or symbol-only, e.g. the `&` in `'Layout/&/Heros'`) are dropped,
 * matching {@link slugifyPath} so a path expands to the same identity it
 * canonicalizes to.
 */
export function expandFolderPath(displayPath: string): LocalFolder[] {
  const segments = displayPath
    .split("/")
    .map((segment) => ({ name: segment, slug: slugify(segment) }))
    .filter((segment) => segment.slug !== "");
  const result: LocalFolder[] = [];
  let parentPath: string | null = null;
  for (const { name, slug } of segments) {
    const path: string = parentPath ? `${parentPath}/${slug}` : slug;
    result.push({ name, path, parentPath });
    parentPath = path;
  }
  return result;
}
