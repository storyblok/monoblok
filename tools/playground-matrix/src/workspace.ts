import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

export type PackageJson = {
  name: string;
  version: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export function repoRoot(): string {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: path.dirname(new URL(import.meta.url).pathname),
    encoding: "utf8",
  }).trim();
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/**
 * Every publishable package in `packages/`. These are the tarballs a consumer
 * would install, and the set we override to in the staged playgrounds.
 */
export function publishablePackages(
  root: string,
): Array<{ name: string; dir: string; version: string }> {
  const packagesDir = path.join(root, "packages");
  const found: Array<{ name: string; dir: string; version: string }> = [];

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = path.join(packagesDir, entry.name, "package.json");
    if (!existsSync(manifest)) continue;
    const pkg = readJson<PackageJson>(manifest);
    if (pkg.private) continue;
    found.push({ name: pkg.name, dir: path.join(packagesDir, entry.name), version: pkg.version });
  }

  return found.sort((a, b) => a.name.localeCompare(b.name));
}

type WorkspaceYaml = {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
};

/**
 * `catalog:` and `catalog:<name>` are a pnpm feature. npm and yarn have no idea
 * what they mean, so every staged manifest has to have them resolved away.
 */
export function catalogResolver(root: string): (specifier: string, dependency: string) => string {
  const workspace = parseYaml(
    readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8"),
  ) as WorkspaceYaml;

  return (specifier, dependency) => {
    if (!specifier.startsWith("catalog:")) return specifier;

    const name = specifier.slice("catalog:".length).trim();
    const catalog =
      name === "" || name === "default" ? workspace.catalog : workspace.catalogs?.[name];
    const resolved = catalog?.[dependency];

    if (!resolved) {
      throw new Error(
        `Cannot resolve "${specifier}" for "${dependency}": no such entry in pnpm-workspace.yaml`,
      );
    }

    return resolved;
  };
}
