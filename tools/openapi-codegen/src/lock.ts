/**
 * Shared helpers for spec.lock and upstream spec hashing.
 *
 * spec.lock records a hash of the downloaded `upstream/` contents:
 *
 *   {
 *     "hash": "sha256:<hex of upstream/ contents>"
 *   }
 *
 * The hash protects against hand edits: `generate` fails when `upstream/`
 * doesn't match it. Correct upstream gaps in `patches.ts` instead.
 */

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "pathe";
import { LOCK_PATH, UPSTREAM_DIR } from "./paths.ts";

export { LOCK_PATH, TOOL_ROOT, UPSTREAM_DIR } from "./paths.ts";

export interface SpecLock {
  hash: string;
}

export function readLock(): SpecLock | null {
  if (!existsSync(LOCK_PATH)) {
    return null;
  }
  return JSON.parse(readFileSync(LOCK_PATH, "utf8")) as SpecLock;
}

export function writeLock(lock: SpecLock): void {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
}

/**
 * Walks `upstream/` and returns `sha256:<hex>` of the sorted
 * (relativePath, content) pairs. Independent of filesystem order.
 */
export function hashUpstream(): string {
  if (!existsSync(UPSTREAM_DIR)) {
    throw new Error(`Upstream spec directory not found: ${UPSTREAM_DIR}`);
  }

  const files: string[] = [];
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      const full = resolve(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        files.push(full);
      }
    }
  }
  walk(UPSTREAM_DIR);
  files.sort();

  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(relative(UPSTREAM_DIR, file));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}
