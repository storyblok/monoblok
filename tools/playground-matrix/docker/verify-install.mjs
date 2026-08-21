/**
 * Runs inside the container, in the installed playground, after the build.
 *
 * Everything here is a property that only holds once a package has been packed
 * and installed for real. Inside the monorepo the same assertions would pass
 * trivially against workspace links and prove nothing.
 *
 * Findings go to stdout as one JSON document so the orchestrator can fold them
 * into the report.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const appDir = process.cwd();
const require = createRequire(path.join(appDir, "noop.js"));
const findings = [];
const packagesUnderTest = (process.env.MATRIX_PACKAGES ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const expectedVersions = JSON.parse(process.env.MATRIX_EXPECTED_VERSIONS ?? "{}");

function report(level, check, message) {
  findings.push({ level, check, message });
}

/**
 * The installed package's manifest.
 *
 * Tries the ESM resolver before the CJS one: an ESM-only package has no
 * `require` condition, so `require.resolve` reports it as missing even though
 * the app imports it perfectly well.
 */
function resolveManifest(name) {
  for (const specifier of [`${name}/package.json`, name]) {
    try {
      const resolved = fileURLToPath(
        import.meta.resolve(specifier, pathToFileURL(path.join(appDir, "noop.js"))),
      );
      const found = manifestAbove(resolved, name);
      if (found) return found;
    } catch {
      // fall through to the CJS resolver
    }
  }

  try {
    return require.resolve(`${name}/package.json`);
  } catch {
    // Not every package exposes `./package.json`; fall back to walking up from
    // whatever the main entry resolves to.
    try {
      let dir = path.dirname(require.resolve(name));
      for (let depth = 0; depth < 8; depth += 1) {
        const candidate = path.join(dir, "package.json");
        try {
          const parsed = JSON.parse(readFileSync(candidate, "utf8"));
          if (parsed.name === name) return candidate;
        } catch {
          // keep walking
        }
        dir = path.dirname(dir);
      }
    } catch {
      return undefined;
    }
    return undefined;
  }
}

/** Walks up from a resolved file to the `package.json` that owns it. */
function manifestAbove(file, name) {
  let dir = path.dirname(file);

  for (let depth = 0; depth < 10; depth += 1) {
    const candidate = path.join(dir, "package.json");
    try {
      if (JSON.parse(readFileSync(candidate, "utf8")).name === name) return candidate;
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return undefined;
}

/** The package resolves at all, and it is the build from this checkout. */
function checkResolution(name) {
  const manifestPath = resolveManifest(name);

  if (!manifestPath) {
    report("error", "resolve", `${name} does not resolve from the installed app`);
    return undefined;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const expected = expectedVersions[name];

  if (expected && manifest.version !== expected) {
    report(
      "error",
      "resolve",
      `${name} resolved to ${manifest.version}; the tarball built from this checkout is ${expected}. ` +
        "Something pulled it from the registry instead.",
    );
  }

  return { manifestPath, manifest, dir: path.dirname(manifestPath) };
}

/**
 * The dependency was externalized, not inlined.
 *
 * A declared runtime dependency has to appear as a bare specifier somewhere in
 * the shipped code. If it does not, the bundler swallowed a copy of it, the
 * declared range is decorative, and a consumer who installs a newer version of
 * that dependency never runs it.
 */
function checkExternalized(name, info) {
  const dependencies = Object.keys(info.manifest.dependencies ?? {});
  if (dependencies.length === 0) return;

  const sources = collectJsFiles(info.dir)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");

  for (const dependency of dependencies) {
    const bare = new RegExp(String.raw`["'](${escapeRegExp(dependency)})(/[^"']*)?["']`);

    if (!bare.test(sources)) {
      report(
        "error",
        "externalized",
        `${name} declares "${dependency}" as a runtime dependency but never imports it by name. ` +
          "Either the bundler inlined a copy — so the version the consumer installs never runs — " +
          "or the dependency is unused and should not be declared.",
      );
    }
  }
}

/** Exactly one copy of each package under test in the whole install tree. */
function checkSingleCopy(name) {
  const copies = new Set();

  const walk = (dir, depth) => {
    if (depth > 10) return;
    let entries;
    try {
      entries = readdirSyncSafe(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" && entry.isDirectory()) {
        const candidate = path.join(dir, "node_modules", ...name.split("/"), "package.json");
        try {
          const parsed = JSON.parse(readFileSync(candidate, "utf8"));
          copies.add(`${parsed.version} @ ${candidate}`);
        } catch {
          // no copy at this level
        }
        walk(path.join(dir, "node_modules"), depth + 1);
      } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
        walk(path.join(dir, entry.name), depth + 1);
      }
    }
  };

  walk(appDir, 0);

  if (copies.size > 1) {
    report("warn", "single-copy", `${name} is installed more than once: ${[...copies].join(", ")}`);
  }
}

/** Both entry conditions actually load. */
async function checkEntryConditions(name, info) {
  // When a manifest has `exports`, `main` and `module` are ignored by every
  // modern resolver. Reading them anyway would demand a `require` entry from a
  // package that deliberately ships ESM only.
  const exportsField = info.manifest.exports;
  const serialized = JSON.stringify(exportsField ?? {});
  const hasRequire = exportsField
    ? serialized.includes('"require"')
    : typeof info.manifest.main === "string";
  const hasImport = exportsField
    ? serialized.includes('"import"') || serialized.includes('"default"')
    : typeof info.manifest.module === "string";

  if (hasImport) {
    try {
      const loaded = await import(name);
      if (Object.keys(loaded).length === 0) {
        report("error", "entry-import", `import("${name}") resolved but exported nothing`);
      }
    } catch (error) {
      report("error", "entry-import", `import("${name}") threw: ${error.message}`);
    }
  }

  if (hasRequire) {
    try {
      const loaded = require(name);
      if (loaded == null || (typeof loaded === "object" && Object.keys(loaded).length === 0)) {
        report("error", "entry-require", `require("${name}") resolved but exported nothing`);
      }
    } catch (error) {
      report("error", "entry-require", `require("${name}") threw: ${error.message}`);
    }
  }
}

/**
 * React Server Components directives survive the bundler exactly once.
 *
 * Two consecutive `"use client"` lines is a real emit bug and a silent one:
 * bundlers differ in whether they tolerate it.
 */
function checkClientDirectives(name, info) {
  for (const file of collectJsFiles(info.dir)) {
    const source = readFileSync(file, "utf8");
    const matches = source.match(/^\s*["']use (client|server)["'];?\s*$/gm) ?? [];
    if (matches.length > 1) {
      report(
        "error",
        "directives",
        `${name}: ${path.relative(info.dir, file)} carries ${matches.length} directive lines`,
      );
    }
  }
}

function collectJsFiles(dir) {
  const found = [];

  const walk = (current, depth) => {
    if (depth > 8) return;
    for (const entry of readdirSyncSafe(current)) {
      if (entry.name === "node_modules") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (/\.(mjs|cjs|js)$/.test(entry.name)) found.push(full);
    }
  };

  walk(dir, 0);
  return found;
}

function readdirSyncSafe(dir) {
  const { readdirSync } = require("node:fs");
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

for (const name of packagesUnderTest) {
  const info = checkResolution(name);
  if (!info) continue;

  checkSingleCopy(name);
  checkExternalized(name, info);
  checkClientDirectives(name, info);
  await checkEntryConditions(name, info);
}

process.stdout.write(`\n__MATRIX_VERIFY__${JSON.stringify(findings)}__MATRIX_VERIFY__\n`);
process.exit(findings.some((finding) => finding.level === "error") ? 1 : 0);
