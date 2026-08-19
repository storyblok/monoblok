#!/usr/bin/env node

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

// `pnpm publish` expands `workspace:*` to an exact version, freezing a consumer's
// dependency at whatever the workspace held at publish time; `workspace:^` expands
// to a caret range. `devDependencies` are exempt because consumers never install
// them, so the range there cannot reach anyone.
const RUNTIME_SECTIONS = ["dependencies", "peerDependencies", "optionalDependencies"];

const violations = [];

for (const entry of readdirSync("packages").toSorted()) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join("packages", entry, "package.json"), "utf-8"));
  } catch {
    continue;
  }

  if (!pkg.name || pkg.private === true) {
    continue;
  }

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

process.stdout.write("All published packages use `workspace:^` for their runtime dependencies\n");
