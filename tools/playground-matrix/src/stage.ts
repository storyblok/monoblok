import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Playground } from "./config.ts";
import { catalogResolver, DEPENDENCY_FIELDS, readJson, repoRoot } from "./workspace.ts";
import type { PackageJson } from "./workspace.ts";

/** Where the tarballs are mounted inside the container. */
export const CONTAINER_TARBALL_DIR = "/tarballs";

const IGNORED_ENTRIES = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".astro",
  ".vercel",
  ".turbo",
  ".yarn",
  ".pnp.cjs",
  ".pnp.loader.mjs",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

/**
 * Copies one playground out of the workspace into a self-contained directory
 * that installs from tarballs instead of from the pnpm workspace.
 *
 * The point of the whole suite lives in this function: inside the monorepo the
 * playgrounds resolve `@storyblok/*` through workspace links, so nothing they
 * do exercises the published manifest. Here they resolve through a real
 * install of a real tarball, the way a consumer would.
 */
/**
 * pnpm 11 stopped reading the `pnpm` field in `package.json`. Overrides now
 * live in `pnpm-workspace.yaml`, and pnpm only warns about the old location, so
 * without this the transitive `@storyblok/*` dependencies would silently come
 * from the registry and the run would test the last release.
 *
 * The file is inert for npm and yarn.
 */
function writePnpmWorkspace(
  appDir: string,
  tarballs: Map<string, string>,
  tarballSpecifier: (name: string) => string | undefined,
): void {
  const lines = ["overrides:"];

  for (const name of tarballs.keys()) {
    lines.push(`  "${name}": "${tarballSpecifier(name)!}"`);
  }

  writeFileSync(path.join(appDir, "pnpm-workspace.yaml"), `${lines.join("\n")}\n`);
}

export function stagePlayground(options: {
  playground: Playground;
  tarballs: Map<string, string>;
  stageDir: string;
}): { dir: string; neutralizedAliases: string[] } {
  const root = repoRoot();
  const { playground, tarballs } = options;
  const target = path.join(path.resolve(options.stageDir), playground.id);

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  cpSync(path.join(root, playground.stageRoot), target, {
    recursive: true,
    filter: (source) => !IGNORED_ENTRIES.has(path.basename(source)),
  });

  const resolveCatalog = catalogResolver(root);
  const tarballSpecifier = (name: string): string | undefined => {
    const file = tarballs.get(name);
    return file ? `file:${CONTAINER_TARBALL_DIR}/${file}` : undefined;
  };

  for (const manifestPath of findManifests(target)) {
    rewriteManifest(manifestPath, resolveCatalog, tarballSpecifier);
  }

  const appManifestPath = path.join(target, playground.appDir, "package.json");
  pinEveryStoryblokPackage(appManifestPath, tarballs, tarballSpecifier);

  writePnpmWorkspace(path.join(target, playground.appDir), tarballs, tarballSpecifier);

  const neutralized = neutralizeSourceAliases(target);

  writeFileSync(path.join(target, ".matrix-app-dir"), `${path.normalize(playground.appDir)}\n`);

  return { dir: target, neutralizedAliases: neutralized };
}

/**
 * A guard against `"@storyblok/x": resolve(…, "../../src/index.ts")` aliases
 * coming back.
 *
 * Several playgrounds used to carry one. It pointed the import straight at
 * TypeScript source, so the bundler output, the `exports` map and the tarball
 * were all bypassed — which made the playground useless as a packaging test and
 * would fail outright here, since `src/` is not part of the staged tree. The
 * aliases are gone from the repo now; this keeps a reintroduced one from
 * silently hollowing out the suite.
 *
 * Returns the files it changed, so a non-empty result shows up in the report
 * rather than quietly rewriting the thing under test.
 */
function neutralizeSourceAliases(target: string): string[] {
  const SOURCE_ALIAS =
    /^[ \t]*["']@storyblok\/[^"']+["']:\s*resolve\([^)]*\.\.\/\.\.\/src\/[^)]*\),?[ \t]*\r?\n/gm;
  const PATHE_IMPORT = /^import \{ resolve \} from ["']pathe["'];[ \t]*\r?\n/gm;

  const changed: string[] = [];

  for (const file of findConfigFiles(target)) {
    const original = readFileSync(file, "utf8");
    let updated = original.replace(SOURCE_ALIAS, "");

    // `pathe` is a devDependency of the workspace, not of the playground. Once
    // the alias is gone the import is both unused and unresolvable.
    if (!/\bresolve\(/.test(updated.replace(PATHE_IMPORT, ""))) {
      updated = updated.replace(PATHE_IMPORT, "");
    }

    if (updated !== original) {
      writeFileSync(file, updated);
      changed.push(path.relative(target, file));
    }
  }

  return changed;
}

const CONFIG_FILE = /\.config\.(ts|js|mjs|cjs)$/;

function findConfigFiles(dir: string): string[] {
  const found: string[] = [];

  const walk = (current: string, depth: number): void => {
    if (depth > 3) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (IGNORED_ENTRIES.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else if (CONFIG_FILE.test(entry.name)) found.push(full);
    }
  };

  walk(dir, 0);
  return found;
}

function findManifests(dir: string): string[] {
  const found: string[] = [];

  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (IGNORED_ENTRIES.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "package.json") found.push(full);
    }
  };

  walk(dir);
  return found;
}

function rewriteManifest(
  manifestPath: string,
  resolveCatalog: (specifier: string, dependency: string) => string,
  tarballSpecifier: (name: string) => string | undefined,
): void {
  const manifest = readJson<PackageJson>(manifestPath);

  for (const field of DEPENDENCY_FIELDS) {
    const deps = manifest[field];
    if (!deps) continue;

    for (const [name, specifier] of Object.entries(deps)) {
      if (specifier.startsWith("workspace:")) {
        const tarball = tarballSpecifier(name);
        if (!tarball) {
          // A workspace dependency that is never published (a `playground-*`
          // sibling, a lint config). Nothing to install it from, so drop it —
          // the file it points at is already inside the staged tree.
          delete deps[name];
          continue;
        }
        deps[name] = tarball;
        continue;
      }

      if (specifier.startsWith("catalog:")) {
        deps[name] = resolveCatalog(specifier, name);
      }
    }
  }

  // The staged app is not a workspace and corepack must not be pinned by the
  // repo's own choice of package manager: the entrypoint picks it per job.
  delete manifest.packageManager;
  delete manifest.nx;

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Forces every `@storyblok/*` package — including ones only reached
 * transitively — to resolve to the tarball built from this checkout.
 *
 * Without this, `@storyblok/react`'s own dependency on `@storyblok/js` would be
 * satisfied from the public registry and the run would quietly test the last
 * release instead of the branch.
 */
function pinEveryStoryblokPackage(
  manifestPath: string,
  tarballs: Map<string, string>,
  tarballSpecifier: (name: string) => string | undefined,
): void {
  const manifest = readJson<PackageJson>(manifestPath);
  const pins: Record<string, string> = {};

  for (const name of tarballs.keys()) {
    pins[name] = tarballSpecifier(name)!;
  }

  manifest.overrides = { ...(manifest.overrides as object), ...pins };
  manifest.resolutions = { ...(manifest.resolutions as object), ...pins };
  manifest.pnpm = {
    ...(manifest.pnpm as object),
    overrides: { ...(manifest.pnpm as { overrides?: object })?.overrides, ...pins },
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
