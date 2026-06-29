import type { ComponentFolder } from '../../types';
import { slugify } from '../../utils/format';

/**
 * `schema init` lays remote blocks out into local directories that mirror their
 * Storyblok component groups, purely for local organization — `schema push`
 * never reads these directories back as groups (pushed blocks are flat). Group
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
