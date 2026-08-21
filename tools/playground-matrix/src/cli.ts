#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import process from "node:process";

import type { Browser } from "playwright";

import { buildJobs, loadConfig, resolvePackageManagerVersions } from "./config.ts";
import { packWorkspace } from "./pack.ts";
import { renderConsoleSummary, writeReport } from "./report.ts";
import type { Report } from "./report.ts";
import { prepareImages, runAll, runJob } from "./run.ts";
import { launchBrowser } from "./smoke.ts";
import { stagePlayground } from "./stage.ts";
import {
  findUndeclaredImports,
  tarballMetrics,
  tarballsManifest,
  verifyTarball,
} from "./verify-pack.ts";
import type { PackFinding, TarballMetrics } from "./verify-pack.ts";
import { repoRoot } from "./workspace.ts";

const USAGE = `
playground-matrix — build and run the playgrounds from packed tarballs, the way
a consumer would, across Node versions and package managers.

  pnpm matrix                                  # smoke tier
  pnpm matrix --tier=full                      # every combination
  pnpm matrix --playground=vue --pm=yarn-latest-pnp
  pnpm matrix --pack-only                      # just pack and inspect tarballs

Options
  --tier=<smoke|full>      Which slice of the matrix to run (default: smoke)
  --playground=<id>        Repeatable. Restrict to these playgrounds
  --pm=<id>                Repeatable. Restrict to these package managers
  --node=<id>              Repeatable. Restrict to these Node versions
  --concurrency=<n>        Containers alive at once (default: 3)
  --skip-pack              Reuse the tarballs from the previous run
  --skip-build             Pack without rebuilding the packages first
  --pack-only              Stop after packing and verifying the tarballs
  --stage-only             Stop after staging the playgrounds (no Docker needed)
  --no-browser             Skip the browser smoke tests
`.trim();

const { values } = parseArgs({
  options: {
    tier: { type: "string", default: "smoke" },
    playground: { type: "string", multiple: true },
    pm: { type: "string", multiple: true },
    node: { type: "string", multiple: true },
    concurrency: { type: "string", default: "3" },
    "skip-pack": { type: "boolean", default: false },
    "skip-build": { type: "boolean", default: false },
    "no-browser": { type: "boolean", default: false },
    "pack-only": { type: "boolean", default: false },
    "stage-only": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (values.help) {
  process.stdout.write(`${USAGE}\n`);
  process.exit(0);
}

const root = repoRoot();
const workDir = path.join(root, ".matrix");
const tarballDir = path.join(workDir, "tarballs");
const stageDir = path.join(workDir, "stage");
const logDir = path.join(workDir, "logs");

mkdirSync(workDir, { recursive: true });

// Two checkouts comparing themselves against each other share one Docker
// daemon, so container names have to be unique per run, not just per job.
const runId = `${Date.now().toString(36)}${process.pid.toString(36)}`;

const config = loadConfig();
const jobs = buildJobs(config, {
  tier: values.tier!,
  playground: values.playground,
  packageManager: values.pm,
  node: values.node,
});

if (jobs.length === 0 && !values["pack-only"]) {
  process.stderr.write("No jobs match the given filters.\n");
  process.exit(1);
}

// --- pack -------------------------------------------------------------------

log(values["skip-pack"] ? "Reusing existing tarballs" : "Packing workspace packages");

const tarballs = values["skip-pack"]
  ? new Map(Object.entries(tarballsManifest(tarballDir)))
  : packWorkspace({ outDir: tarballDir, skipBuild: values["skip-build"] });

const packFindings: PackFinding[] = [];
const packedVersions: Record<string, string> = {};
const tarballSizes: Record<string, TarballMetrics> = {};

for (const [name, file] of tarballs) {
  const { manifest, findings } = verifyTarball(path.join(tarballDir, file));
  packedVersions[name] = manifest.version;
  tarballSizes[name] = tarballMetrics(path.join(tarballDir, file));
  packFindings.push(...findings, ...findUndeclaredImports(tarballDir, file));
}

log(`Packed ${tarballs.size} package(s); ${packFindings.length} tarball finding(s)`);
for (const finding of packFindings) {
  log(`  ${finding.level}: ${finding.package} — ${finding.message}`);
}

if (values["pack-only"]) {
  process.exit(packFindings.some((finding) => finding.level === "error") ? 1 : 0);
}

// --- stage ------------------------------------------------------------------

log("Staging playgrounds");
const staged = new Set<string>();
const neutralizedAliases: Record<string, string[]> = {};

for (const job of jobs) {
  if (staged.has(job.playground.id)) continue;
  const result = stagePlayground({ playground: job.playground, tarballs, stageDir });
  staged.add(job.playground.id);
  if (result.neutralizedAliases.length > 0) {
    neutralizedAliases[job.playground.id] = result.neutralizedAliases;
  }
}

log(`Staged ${staged.size} playground(s)`);
for (const [id, files] of Object.entries(neutralizedAliases)) {
  log(`  ${id}: dropped source aliases in ${files.join(", ")}`);
}

if (values["stage-only"]) process.exit(0);

// --- images -----------------------------------------------------------------

const nodeVersions = [...new Set(jobs.map((job) => job.node.version))];
log(`Building image(s) for Node ${nodeVersions.join(", ")}`);
prepareImages(nodeVersions);

const resolvedPackageManagerVersions = Object.fromEntries(
  resolvePackageManagerVersions([...new Set(jobs.map((job) => job.packageManager))]),
);

// --- run --------------------------------------------------------------------

let browser: Browser | undefined;
if (!values["no-browser"]) {
  try {
    browser = await launchBrowser();
  } catch (error) {
    log(`No browser available (${(error as Error).message}); running without smoke tests`);
  }
}

log(`Running ${jobs.length} job(s) with concurrency ${values.concurrency}`);

const results = await runAll(
  jobs,
  Number(values.concurrency),
  (job) =>
    runJob({
      job,
      stageDir,
      tarballDir,
      logDir,
      expectedVersions: packedVersions,
      browser,
      runId,
    }),
  (result) => {
    log(
      `  [${result.status === "passed" ? "pass" : "FAIL"}] ${result.job}` +
        (result.failedPhase ? ` (${result.failedPhase})` : ""),
    );
  },
);

await browser?.close();

// --- report -----------------------------------------------------------------

const report: Report = {
  startedAt: new Date().toISOString(),
  tier: values.tier!,
  resolvedPackageManagerVersions,
  packedVersions,
  tarballMetrics: tarballSizes,
  packFindings,
  neutralizedAliases,
  jobs: results.sort((a, b) => a.job.localeCompare(b.job)),
};

const written = writeReport(report, workDir);
process.stdout.write(`\n${renderConsoleSummary(report)}\n`);
process.stdout.write(`\nReport: ${written.markdown}\n`);

const failed =
  results.some((result) => result.status === "failed") ||
  packFindings.some((finding) => finding.level === "error");

process.exit(failed ? 1 : 0);

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}
