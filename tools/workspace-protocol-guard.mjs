#!/usr/bin/env node

import { globSync, readFileSync } from "fs";

// `pnpm publish` expands `workspace:*` to an exact version, freezing a consumer's
// dependency at whatever the workspace held at publish time; `workspace:^` expands
// to a caret range. `devDependencies` are exempt because consumers never install
// them, so the range there cannot reach anyone.
const RUNTIME_SECTIONS = ["dependencies", "peerDependencies", "optionalDependencies"];

// Every workspace member has to be checked, not just `packages/*`: the invariant
// belongs to whatever gets published, and the workspace globs are the only
// authoritative list of what that can be.
function workspaceManifests() {
  const workspace = readFileSync("pnpm-workspace.yaml", "utf-8");
  const block = workspace.match(/^packages:\n((?:[ \t]+-[ \t]*\S+\n)+)/m);

  if (!block) {
    process.stderr.write("Could not read the `packages:` globs from pnpm-workspace.yaml\n");
    process.exit(1);
  }

  const globs = block[1]
    .split("\n")
    .map((line) =>
      line
        .replace(/^[ \t]+-[ \t]*/, "")
        .trim()
        .replace(/^["']|["']$/g, ""),
    )
    .filter(Boolean);

  const manifests = globs.flatMap((glob) => globSync(`${glob}/package.json`));

  return [...new Set(manifests)].toSorted();
}

const manifests = workspaceManifests();
const violations = [];
let checked = 0;

for (const manifest of manifests) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(manifest, "utf-8"));
  } catch {
    continue;
  }

  if (!pkg.name || pkg.private === true) {
    continue;
  }

  checked += 1;

  for (const section of RUNTIME_SECTIONS) {
    for (const [dep, specifier] of Object.entries(pkg[section] ?? {})) {
      if (specifier.startsWith?.("workspace:") && specifier !== "workspace:^") {
        violations.push(`  ${pkg.name}: ${section}.${dep} is "${specifier}"`);
      }
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Runtime dependencies of published packages must use "workspace:^", not another workspace specifier.\n` +
      `\`devDependencies\` are exempt and may keep \`workspace:*\`.\n\n${violations.join("\n")}\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `All ${checked} published workspace packages use \`workspace:^\` for their runtime dependencies\n`,
);
