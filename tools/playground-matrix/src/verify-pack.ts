import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";

import { readJson } from "./workspace.ts";
import type { PackageJson } from "./workspace.ts";

export type PackFinding = { package: string; level: "error" | "warn"; message: string };

/**
 * Checks that a packed tarball is the artifact a release would produce.
 *
 * `nx release publish` shells out to `pnpm publish`, so `pnpm pack` runs the
 * same manifest transform and the same `files` resolution. That makes the
 * tarball right by construction — but only as long as the manifest inside it
 * survives the transform intact, which is what this asserts:
 *
 *  1. no `workspace:` or `catalog:` specifier leaks into the published
 *     manifest (either one is an install failure for every consumer);
 *  2. every path the manifest advertises — `main`, `module`, `types`, `bin`,
 *     and each leaf of `exports` — actually exists in the tarball. This is the
 *     failure mode a bundler migration produces: the manifest is updated for
 *     the new layout and one entry still points at the old one.
 */
export function verifyTarball(tarballPath: string): {
  manifest: PackageJson;
  findings: PackFinding[];
} {
  const files = listTarball(tarballPath);
  const manifest = readManifestFromTarball(tarballPath);
  const findings: PackFinding[] = [];
  const name = manifest.name;

  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
    for (const [dependency, specifier] of Object.entries(manifest[field] ?? {})) {
      if (specifier.startsWith("workspace:") || specifier.startsWith("catalog:")) {
        findings.push({
          package: name,
          level: "error",
          message: `${field}.${dependency} is "${specifier}" in the packed manifest; it must be a real range`,
        });
      }
    }
  }

  for (const [field, value] of advertisedPaths(manifest)) {
    const normalized = normalizeEntry(value);
    if (!normalized) continue;
    if (!files.has(normalized)) {
      findings.push({
        package: name,
        level: "error",
        message: `${field} points at "${value}", which is not in the tarball`,
      });
    }
  }

  return { manifest, findings };
}

/** Every file inside the tarball, relative to the package root. */
export function listTarball(tarballPath: string): Set<string> {
  const output = execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf8" });

  return new Set(
    output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.endsWith("/"))
      .map((line) => line.replace(/^package\//, "")),
  );
}

export function readManifestFromTarball(tarballPath: string): PackageJson {
  const raw = execFileSync("tar", ["-xzOf", tarballPath, "package/package.json"], {
    encoding: "utf8",
  });
  return JSON.parse(raw) as PackageJson;
}

function* advertisedPaths(manifest: PackageJson): Generator<[string, string]> {
  for (const field of ["main", "module", "types", "typings", "browser", "style"] as const) {
    const value = manifest[field];
    if (typeof value === "string") yield [field, value];
  }

  if (typeof manifest.bin === "string") yield ["bin", manifest.bin];
  else if (manifest.bin && typeof manifest.bin === "object") {
    for (const [key, value] of Object.entries(manifest.bin as Record<string, string>)) {
      yield [`bin.${key}`, value];
    }
  }

  if (manifest.exports) yield* walkExports("exports", manifest.exports);
}

function* walkExports(prefix: string, node: unknown): Generator<[string, string]> {
  if (typeof node === "string") {
    yield [prefix, node];
    return;
  }
  if (!node || typeof node !== "object") return;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    yield* walkExports(`${prefix}.${key}`, value);
  }
}

function normalizeEntry(value: string): string | undefined {
  if (!value.startsWith(".")) return undefined; // external specifier, not a file
  if (value.includes("*")) return undefined; // wildcard subpath; not resolvable statically
  return path.posix.normalize(value.replace(/^\.\//, ""));
}

/**
 * A dependency the code imports but the manifest never declares. pnpm's
 * isolated store hides these inside the monorepo and npm's hoisting hides them
 * in a lot of consumer projects too, right up until one where it does not.
 */
export function findUndeclaredImports(tarballDir: string, tarballFile: string): PackFinding[] {
  const tarballPath = path.join(tarballDir, tarballFile);
  const manifest = readManifestFromTarball(tarballPath);
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);

  const findings: PackFinding[] = [];
  const files = [...listTarball(tarballPath)].filter((file) => /\.(mjs|cjs|js)$/.test(file));

  for (const file of files) {
    const source = execFileSync("tar", ["-xzOf", tarballPath, `package/${file}`], {
      encoding: "utf8",
    });

    for (const specifier of externalSpecifiers(source)) {
      const packageName = toPackageName(specifier);
      if (!packageName) continue;
      if (packageName === manifest.name) continue;
      if (declared.has(packageName) || isBuiltin(packageName)) continue;
      findings.push({
        package: manifest.name,
        // A warning, not an error: a framework module may legitimately import
        // something the host provides (`@nuxt/kit`, `vue` inside a Nuxt
        // module). The authoritative check is `verify-install.mjs`, which
        // resolves for real inside an installed consumer.
        level: "warn",
        message: `${file} imports "${specifier}" but "${packageName}" is not a declared dependency`,
      });
    }
  }

  return dedupe(findings);
}

// Deliberately anchored on the quote that closes the specifier rather than on
// the statement that opens it. Scanning bundled output means matching minified
// code, template literals and string tables; a loose pattern picks up fragments
// of all three and reports them as imports.
const IMPORT_PATTERNS = [
  /\bfrom\s*(["'])([^"'`\n]+)\1/g,
  /\bimport\s*\(\s*(["'])([^"'`\n]+)\1\s*\)/g,
  /\brequire\s*\(\s*(["'])([^"'`\n]+)\1\s*\)/g,
  /\bimport\s*(["'])([^"'`\n]+)\1\s*;/g,
];

function externalSpecifiers(source: string): string[] {
  const found = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[2]!;
      if (specifier.startsWith(".") || specifier.startsWith("/")) continue;
      if (specifier.startsWith("#")) continue; // subpath import, resolved by the manifest
      found.add(specifier);
    }
  }

  return [...found];
}

/**
 * The package a specifier belongs to, or `undefined` when the specifier is not
 * a package at all: a bundler virtual module (`virtual:…`), a URL, or a
 * fragment of an interpolated string that survived minification.
 */
const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

function toPackageName(specifier: string): string | undefined {
  if (specifier.includes("${") || /\s/.test(specifier)) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(specifier) && !specifier.startsWith("node:")) {
    return undefined; // virtual:, data:, https:, astro: …
  }

  const parts = specifier.replace(/^node:/, "").split("/");
  const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;

  return PACKAGE_NAME.test(name) ? name : undefined;
}

function isBuiltin(name: string): boolean {
  return builtinModules.has(name);
}

const builtinModules = new Set(
  (process.getBuiltinModule?.("module") as typeof import("node:module") | undefined)
    ?.builtinModules ?? [],
);

function dedupe(findings: PackFinding[]): PackFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.package}|${finding.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type TarballMetrics = {
  packedBytes: number;
  unpackedBytes: number;
  files: number;
  distBytes: number;
};

/**
 * What the consumer downloads and what lands on their disk.
 *
 * Both matter and they move independently: externalizing a dependency shrinks
 * the tarball without shrinking anything the consumer ends up installing.
 */
export function tarballMetrics(tarballPath: string): TarballMetrics {
  const listing = execFileSync("tar", ["-tzvf", tarballPath], { encoding: "utf8" });
  let unpackedBytes = 0;
  let distBytes = 0;
  let files = 0;

  // `tar -tzvf` prints: perms, links, owner, group, size, month, day,
  // year-or-time, name. Anchoring on field positions rather than a loose
  // pattern, because the name can contain spaces and the date column does too.
  for (const line of listing.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) continue;

    const size = Number(parts[4]);
    if (!Number.isFinite(size)) continue;

    const name = parts
      .slice(8)
      .join(" ")
      .replace(/^package\//, "");
    if (name === "" || name.endsWith("/")) continue;

    files += 1;
    unpackedBytes += size;
    if (name.startsWith("dist/")) distBytes += size;
  }

  return { packedBytes: statSync(tarballPath).size, unpackedBytes, files, distBytes };
}

export function tarballsManifest(dir: string): Record<string, string> {
  return readJson<Record<string, string>>(path.join(dir, "tarballs.json"));
}
