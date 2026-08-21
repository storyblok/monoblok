import { execFileSync } from "node:child_process";
import path from "node:path";

import { readJson, repoRoot } from "./workspace.ts";

export type ServeConfig =
  | { type: "none" }
  | { type: "static"; dir: string }
  | { type: "script"; script: string; port: number }
  | { type: "node"; entry: string; port: number };

export type Playground = {
  id: string;
  /** Directory the build writes into. Measured for the size report. */
  dist?: string;
  /** Marker strings counted in the build output, as label -> literal. */
  fingerprints?: Record<string, string>;
  covers: string[];
  stageRoot: string;
  appDir: string;
  build: string;
  serve: ServeConfig;
  smoke?: {
    expectText?: string[];
    expectSelector?: string[];
    allowConsoleErrors?: boolean;
  };
};

export type PackageManager = {
  id: string;
  pm: "npm" | "pnpm" | "yarn";
  channel: string;
  version: string;
  linker: string;
};

export type NodeTarget = { id: string; version: string; channel: string };

export type MatrixConfig = {
  node: NodeTarget[];
  packageManagers: PackageManager[];
  tiers: Record<string, { node: string[]; packageManagers: string[] }>;
  playgrounds: Playground[];
};

export type Job = {
  id: string;
  playground: Playground;
  packageManager: PackageManager;
  node: NodeTarget;
};

export function loadConfig(): MatrixConfig {
  return readJson<MatrixConfig>(
    path.join(repoRoot(), "tools/playground-matrix/matrix.config.json"),
  );
}

export type Filters = {
  tier: string;
  playground?: string[];
  packageManager?: string[];
  node?: string[];
};

export function buildJobs(config: MatrixConfig, filters: Filters): Job[] {
  const tier = config.tiers[filters.tier];
  if (!tier) {
    throw new Error(
      `Unknown tier "${filters.tier}". Known tiers: ${Object.keys(config.tiers).join(", ")}`,
    );
  }

  const nodes = config.node
    .filter((node) => tier.node.includes(node.id))
    .filter((node) => !filters.node || filters.node.includes(node.id));

  const packageManagers = config.packageManagers
    .filter((pm) => tier.packageManagers.includes(pm.id))
    .filter((pm) => !filters.packageManager || filters.packageManager.includes(pm.id));

  const playgrounds = config.playgrounds.filter(
    (playground) => !filters.playground || filters.playground.includes(playground.id),
  );

  const jobs: Job[] = [];
  for (const node of nodes) {
    for (const pm of packageManagers) {
      for (const playground of playgrounds) {
        jobs.push({
          id: `${playground.id}__${pm.id}__node${node.id}`,
          playground,
          packageManager: pm,
          node,
        });
      }
    }
  }

  return jobs;
}

/**
 * Turns `latest` into the version the registry served at the time of the run,
 * so a report says which pnpm actually ran instead of "whatever was newest".
 */
export function resolvePackageManagerVersions(
  packageManagers: PackageManager[],
): Map<string, string> {
  const resolved = new Map<string, string>();

  for (const pm of packageManagers) {
    const key = `${pm.pm}@${pm.version}`;
    if (resolved.has(key)) continue;

    const version = execFileSync("npm", ["view", key, "version"], { encoding: "utf8" })
      .trim()
      .split("\n")
      .at(-1)!
      .trim();

    resolved.set(key, version);
  }

  return resolved;
}
