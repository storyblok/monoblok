import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { publishablePackages, readJson, repoRoot } from "./workspace.ts";
import type { PackageJson } from "./workspace.ts";

/**
 * Guards the assumption the whole suite rests on: that `pnpm pack` produces the
 * same tarball a release would publish.
 *
 * The chain is `nx release publish` → `@nx/js:release-publish` → the
 * workspace's package manager's `publish`. With pnpm that is `pnpm publish`,
 * which shares its packer and its manifest transform with `pnpm pack` —
 * including rewriting `workspace:^` into a real caret range. `npm pack` does
 * not do that rewrite, so if the workspace ever switches package managers this
 * packer silently starts producing uninstallable tarballs. Fail loudly instead.
 */
export function assertReleaseParity(root: string): void {
  const rootManifest = readJson<PackageJson>(path.join(root, "package.json"));
  const packageManager = String(rootManifest.packageManager ?? "");

  if (!packageManager.startsWith("pnpm@")) {
    throw new Error(
      `This packer uses \`pnpm pack\` because \`nx release publish\` runs \`pnpm publish\`. ` +
        `The workspace now declares "${packageManager}". Re-check how releases pack before trusting these tarballs.`,
    );
  }

  const executor = JSON.parse(
    execFileSync("pnpm", ["nx", "show", "project", "@storyblok/js", "--json"], {
      cwd: root,
      encoding: "utf8",
    }),
  ).targets?.["nx-release-publish"]?.executor;

  if (executor !== "@nx/js:release-publish") {
    throw new Error(
      `Expected releases to publish through "@nx/js:release-publish", found "${executor}". ` +
        "Re-check how releases pack before trusting these tarballs.",
    );
  }
}

/**
 * Builds every publishable package and packs it into a tarball.
 *
 * `pnpm pack` rather than `npm pack` on purpose: pnpm rewrites `workspace:^`
 * specifiers into real semver ranges the way `pnpm publish` would, so the
 * tarball's manifest matches what actually reaches the registry. `npm pack`
 * would leave `workspace:^` in place and every install would fail.
 */
export function packWorkspace(options: {
  outDir: string;
  skipBuild?: boolean;
}): Map<string, string> {
  const root = repoRoot();
  const outDir = path.resolve(options.outDir);

  assertReleaseParity(root);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // The exact command `.github/workflows/publish.yaml` runs before
  // `nx release publish`. Anything else risks packing a differently-built dist
  // than a release would.
  if (!options.skipBuild) {
    run("pnpm", ["nx", "run-many", "-p=tag:npm:public", "-t", "build"], root);
  }

  const tarballs = new Map<string, string>();

  for (const pkg of publishablePackages(root)) {
    const before = new Set(readdirSync(outDir));
    run("pnpm", ["pack", "--pack-destination", outDir], pkg.dir);
    const created = readdirSync(outDir).filter((file) => !before.has(file));

    if (created.length !== 1) {
      throw new Error(`Expected exactly one tarball from ${pkg.name}, got ${created.length}`);
    }

    tarballs.set(pkg.name, created[0]!);
  }

  writeFileSync(
    path.join(outDir, "tarballs.json"),
    `${JSON.stringify(Object.fromEntries(tarballs), null, 2)}\n`,
  );

  return tarballs;
}

function run(command: string, args: string[], cwd: string): void {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}
