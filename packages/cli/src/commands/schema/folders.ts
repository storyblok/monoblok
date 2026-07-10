import type { ComponentFolder } from '../../types';
import { slugify } from '../../utils/format';
import type { LocalFolder } from './types';

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
  const byUuid = new Map(folders.map(folder => [folder.uuid, folder]));
  const cache = new Map<string, string[]>();

  // `visited` tracks the groups in the current upward walk so a self-referential
  // (`parent_uuid === uuid`) or cyclic `parent_uuid` chain stops instead of
  // recursing forever. On a detected cycle the chain is cut and the group is
  // treated as a path root. (The `cache` can't guard this: it's only populated
  // after the recursive call returns, so it's empty while a cycle is unwinding.)
  function pathFor(uuid: string | null, visited: Set<string>): string[] {
    if (!uuid) { return []; }
    const cached = cache.get(uuid);
    if (cached) { return cached; }
    const folder = byUuid.get(uuid);
    if (!folder) { return []; }
    if (visited.has(uuid)) { return []; }
    visited.add(uuid);
    const path = [...pathFor(folder.parent_uuid, visited), slugify(folder.name)];
    cache.set(uuid, path);
    return path;
  }

  for (const folder of folders) { pathFor(folder.uuid, new Set()); }
  return cache;
}

/**
 * Slugifies each `/` segment of a display path: `'My Layout/Heros'` →
 * `'my-layout/heros'`. Empty segments are dropped (matching
 * {@link expandFolderPath}), so `'Layout/'` → `'layout'`, not `'layout/'`.
 *
 * This is folder-path *identity*: a folder authored as a `defineFolder` ref or
 * as a string shorthand with different casing/separators must canonicalize to
 * the same value here and in `@storyblok/schema`'s `slugifyFolderPath`, which
 * the schema validators use. The two implementations share this algorithm (the
 * per-segment `slugify`) and are each locked by golden-case tests; keep them in
 * sync. (The CLI does not import the schema helper to avoid a runtime dependency
 * on `@storyblok/schema`.)
 */
export function slugifyPath(displayPath: string): string {
  return displayPath.split('/').filter(Boolean).map(segment => slugify(segment)).join('/');
}

/**
 * Expands a display path into one {@link LocalFolder} per prefix, parent-first.
 * `'Layout/Heros'` → Layout (root) then Heros (child). Paths are slug space;
 * names keep the display casing for group creation.
 */
export function expandFolderPath(displayPath: string): LocalFolder[] {
  const segments = displayPath.split('/').filter(Boolean);
  const result: LocalFolder[] = [];
  let parentPath: string | null = null;
  for (const segment of segments) {
    const path: string = parentPath ? `${parentPath}/${slugify(segment)}` : slugify(segment);
    result.push({ name: segment, path, parentPath });
    parentPath = path;
  }
  return result;
}
