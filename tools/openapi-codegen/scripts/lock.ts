/**
 * Shared helpers for spec.lock and cache content hashing.
 *
 * spec.lock pins the upstream commit and the resulting cache contents:
 *
 *   {
 *     "repo": "storyblok/openapi-wdx",
 *     "sha":  "<upstream commit SHA>",
 *     "hash": "sha256:<hex of cache contents>"
 *   }
 *
 * The hash protects against partial fetches and hand edits — `verify` fails
 * if the cache on disk doesn't match what spec.lock claims.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'pathe';
import { CACHE_DIR, LOCK_PATH } from '../src/paths.ts';

export { CACHE_DIR, LOCK_PATH, TOOL_ROOT } from '../src/paths.ts';
export const UPSTREAM_REPO = 'storyblok/openapi-wdx';

export interface SpecLock {
  repo: string;
  sha: string;
  hash: string;
}

export function readLock(): SpecLock | null {
  if (!existsSync(LOCK_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as SpecLock;
}

export function writeLock(lock: SpecLock): void {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
}

/**
 * Walks `.openapi-cache/` and returns `sha256:<hex>` of the sorted
 * (relativePath, content) pairs. Independent of filesystem order.
 */
export function hashCache(): string {
  if (!existsSync(CACHE_DIR)) {
    throw new Error(`Cache directory not found: ${CACHE_DIR}`);
  }

  const files: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      }
      else {
        files.push(full);
      }
    }
  }
  walk(CACHE_DIR);
  files.sort();

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(relative(CACHE_DIR, file));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return `sha256:${hash.digest('hex')}`;
}
