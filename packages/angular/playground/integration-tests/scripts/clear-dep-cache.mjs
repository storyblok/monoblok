import { readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// The dev server prebundles workspace dependencies into
// `.angular/cache/<version>/integration-tests/vite/deps` and keys that cache on
// the dependency graph, not on the contents of the linked `dist` directories.
// Rebuilding `@storyblok/live-preview` or `@storyblok/angular` therefore leaves
// the prebundled copy untouched, and the QA run silently exercises the code as
// it was when the cache was first written.
//
// That is the exact trap this harness must not fall into: the suite is here to
// catch live preview regressions, and a stale cache makes it pass against the
// old build. Dropping only the `deps` directory keeps the rest of the build
// cache warm.
const scriptDir = dirname(fileURLToPath(import.meta.url));
const cacheDir = resolve(scriptDir, "../../../.angular/cache");

let versions = [];
try {
  versions = await readdir(cacheDir);
} catch (error) {
  if (error.code === "ENOENT") process.exit(0);
  throw error;
}

for (const version of versions) {
  await rm(join(cacheDir, version, "integration-tests", "vite", "deps"), {
    recursive: true,
    force: true,
  });
}
