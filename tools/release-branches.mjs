#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

/**
 * Reads `packages/*​/package.json` and splits packages by whether their
 * `release.branches` field allows releasing from the given branch.
 * Packages without a `release.branches` field are eligible on every
 * release branch.
 */
export function getBranchEligiblePackages(branch, packagesDir = "packages") {
  const eligible = [];
  const excluded = [];

  for (const entry of readdirSync(packagesDir).sort()) {
    const pkgPath = join(packagesDir, entry, "package.json");

    let stat;
    try {
      stat = statSync(pkgPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    let pkg;
    try {
      pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    } catch (err) {
      process.stderr.write(`⚠️  Warning: failed to parse ${pkgPath} — skipping (${err.message})\n`);
      continue;
    }

    if (!pkg.name) continue;

    const branches = pkg.release?.branches;
    if (!Array.isArray(branches)) {
      eligible.push(pkg.name);
      continue;
    }

    const branchNames = branches.map((b) => (typeof b === "string" ? b : b?.name)).filter(Boolean);

    if (branchNames.includes(branch)) {
      eligible.push(pkg.name);
    } else {
      excluded.push(pkg.name);
    }
  }

  return { eligible, excluded };
}

// CLI: `node tools/release-branches.mjs <branch>` prints eligible packages
// as a comma-separated list on stdout. Used by .github/workflows/publish.yaml.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const branch = process.argv[2];
  if (!branch) {
    process.stderr.write("Usage: node tools/release-branches.mjs <branch>\n");
    process.exit(1);
  }
  const { eligible } = getBranchEligiblePackages(branch);
  process.stdout.write(eligible.join(","));
}
