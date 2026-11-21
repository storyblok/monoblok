import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const LOCK_POLL_MS = 500;
/** A lock older than this belongs to a crashed builder. */
const STALE_LOCK_MS = 15 * 60 * 1000;

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Copy-on-write clone where the filesystem supports it (APFS, btrfs), a plain copy otherwise. */
function cloneContents(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true });
  const args =
    process.platform === "darwin"
      ? ["-cR", `${source}/.`, target]
      : ["-a", "--reflink=auto", `${source}/.`, target];
  execFileSync("cp", args);
}

function acquireLock(lock: string, ready: string): boolean {
  for (;;) {
    if (fs.existsSync(ready)) return false;
    try {
      fs.mkdirSync(lock);
    } catch {
      const lockedAt = fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs;
      if (lockedAt !== undefined && Date.now() - lockedAt > STALE_LOCK_MS) {
        fs.rmSync(lock, { recursive: true, force: true });
      }
      sleep(LOCK_POLL_MS);
      continue;
    }
    // Another builder may have finished between the readiness check and taking the lock.
    if (!fs.existsSync(ready)) return true;
    fs.rmSync(lock, { recursive: true, force: true });
    return false;
  }
}

/**
 * Fills `target` with the output of `build`, running `build` once per `key` across processes.
 * Parallel jobs for the same key wait for the first one and then clone its result.
 */
export function cloneCachedDirectory({
  cacheRoot,
  key,
  target,
  build,
}: {
  cacheRoot: string;
  key: string;
  target: string;
  build: (dir: string) => void;
}): void {
  fs.mkdirSync(cacheRoot, { recursive: true });
  // Built in place, not renamed into place: installs bake absolute paths into the tree.
  const dir = path.join(cacheRoot, key);
  const ready = `${dir}.ready`;
  const lock = `${dir}.lock`;
  if (acquireLock(lock, ready)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir);
      build(dir);
      fs.writeFileSync(ready, "");
    } catch (error) {
      fs.rmSync(dir, { recursive: true, force: true });
      throw error;
    } finally {
      fs.rmSync(lock, { recursive: true, force: true });
    }
  }
  cloneContents(dir, target);
}
