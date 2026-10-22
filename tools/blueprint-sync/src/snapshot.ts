import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "pathe";

/**
 * Remembers `files` (relative to `dir`) and returns a function that puts them back, deleting any
 * that did not exist. The caller must run it on every exit path.
 */
export function snapshot(dir: string, files: string[]): () => void {
  const saved = files.map((file) => {
    const path = join(dir, file);
    return { path, content: existsSync(path) ? readFileSync(path) : undefined };
  });
  return () => {
    for (const { path, content } of saved) {
      if (content === undefined) {
        rmSync(path, { force: true });
      } else {
        writeFileSync(path, content);
      }
    }
  };
}
