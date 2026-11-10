import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "pathe";

/**
 * Returns the sha256 of every file under `dir`, keyed by relative path. Line
 * endings are normalized, so the hash is the same on every platform.
 */
export function hashDirectory(dir: string): string {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, resolve(entry.parentPath, entry.name)))
    .sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(resolve(dir, file), "utf8").replace(/\r\n/g, "\n"));
    hash.update("\0");
  }
  return hash.digest("hex");
}
