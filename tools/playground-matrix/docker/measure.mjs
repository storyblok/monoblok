/**
 * Measures what the build and the install actually produced.
 *
 * Runs inside the container, in the installed app, after the build. The point
 * of measuring here rather than in the workspace is that externalizing a
 * dependency moves weight rather than removing it: the tarball shrinks, the
 * install grows, and the app bundle only shrinks if the bundler was shipping
 * two copies. Only a real install shows all three at once.
 *
 * Writes one JSON document to stdout.
 */
import { createRequire } from "node:module";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

const appDir = process.cwd();
const require = createRequire(path.join(appDir, "noop.js"));

const COMPRESSIBLE = new Set([".js", ".mjs", ".cjs", ".css", ".html", ".json", ".svg"]);

function walk(dir) {
  const files = [];

  const recurse = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) recurse(full);
      else if (entry.isFile()) files.push(full);
    }
  };

  recurse(dir);
  return files;
}

/** Total bytes, file count, and a per-extension breakdown of a directory. */
function measureTree(dir, { gzip = false } = {}) {
  const files = walk(dir);
  const byExtension = {};
  let bytes = 0;
  let gzipBytes = 0;

  for (const file of files) {
    const size = statSync(file).size;
    const extension = path.extname(file) || "(none)";

    bytes += size;
    byExtension[extension] ??= { files: 0, bytes: 0 };
    byExtension[extension].files += 1;
    byExtension[extension].bytes += size;

    if (gzip && COMPRESSIBLE.has(extension)) {
      gzipBytes += gzipSync(readFileSync(file)).length;
    }
  }

  return {
    dir: path.relative(appDir, dir) || ".",
    files: files.length,
    bytes,
    ...(gzip ? { gzipBytes } : {}),
    byExtension: Object.fromEntries(
      Object.entries(byExtension).sort((a, b) => b[1].bytes - a[1].bytes),
    ),
  };
}

function resolvePackageDir(name) {
  for (const specifier of [`${name}/package.json`, name]) {
    try {
      let dir = path.dirname(require.resolve(specifier));
      for (let depth = 0; depth < 10; depth += 1) {
        try {
          if (JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).name === name) {
            return dir;
          }
        } catch {
          // keep walking
        }
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    } catch {
      // try the next specifier
    }
  }

  return undefined;
}

/**
 * Counts marker strings across the build output.
 *
 * A bundled dependency has no version and no module identity once it is inside
 * someone else's file, so the only way to count copies is to look for a string
 * literal that survives minification. One occurrence per copy.
 */
function countFingerprints(dir, fingerprints) {
  const counts = {};
  const sources = walk(dir)
    .filter((file) => /\.(js|mjs|cjs|html|css)$/.test(file))
    .map((file) => readFileSync(file, "utf8"));

  for (const [label, marker] of Object.entries(fingerprints)) {
    counts[label] = sources.reduce((total, source) => total + source.split(marker).length - 1, 0);
  }

  return counts;
}

const distDir = process.env.MATRIX_DIST_DIR;
const fingerprints = JSON.parse(process.env.MATRIX_FINGERPRINTS ?? "{}");
const packages = (process.env.MATRIX_PACKAGES ?? "")
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean);

const metrics = {
  build: distDir ? measureTree(path.join(appDir, distDir), { gzip: true }) : undefined,
  fingerprints:
    distDir && Object.keys(fingerprints).length > 0
      ? countFingerprints(path.join(appDir, distDir), fingerprints)
      : undefined,
  install: measureTree(path.join(appDir, "node_modules")),
  packages: {},
};

for (const name of packages) {
  const dir = resolvePackageDir(name);
  if (!dir) continue;
  metrics.packages[name] = {
    version: JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")).version,
    ...measureTree(dir),
  };
}

process.stdout.write(`\n__MATRIX_METRICS__${JSON.stringify(metrics)}__MATRIX_METRICS__\n`);
