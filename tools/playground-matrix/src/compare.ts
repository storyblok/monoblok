#!/usr/bin/env node
/**
 * Diffs two `report.json` files and prints the size and timing deltas.
 *
 * Usage: compare <before/report.json> <after/report.json> [beforeLabel] [afterLabel]
 *
 * A packaging change moves weight between three places at once, so all three
 * are reported side by side: what the consumer downloads (the tarball), what
 * ends up in their `node_modules` (the install), and what their own build emits
 * (the app bundle). Reading any one of them alone is misleading.
 */
import path from "node:path";
import process from "node:process";

import type { Report } from "./report.ts";
import { readJson } from "./workspace.ts";

const [beforePath, afterPath, beforeLabel = "before", afterLabel = "after"] = process.argv.slice(2);

if (!beforePath || !afterPath) {
  process.stderr.write("Usage: compare <before/report.json> <after/report.json> [labels…]\n");
  process.exit(1);
}

const before = readJson<Report>(path.resolve(beforePath));
const after = readJson<Report>(path.resolve(afterPath));

const lines: string[] = [];

lines.push(`# Packaging comparison: ${beforeLabel} vs ${afterLabel}`, "");

// --- tarballs ---------------------------------------------------------------

lines.push("## Published tarballs", "");
lines.push(
  `| Package | Packed ${beforeLabel} | Packed ${afterLabel} | Δ packed | Unpacked ${beforeLabel} | Unpacked ${afterLabel} | Δ unpacked | Files ${beforeLabel} | Files ${afterLabel} |`,
);
lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

for (const name of sortedKeys(before.tarballMetrics, after.tarballMetrics)) {
  const a = before.tarballMetrics?.[name];
  const b = after.tarballMetrics?.[name];
  if (!a || !b) continue;
  if (a.packedBytes === b.packedBytes && a.files === b.files) continue;

  lines.push(
    `| \`${name}\` | ${kb(a.packedBytes)} | ${kb(b.packedBytes)} | ${delta(a.packedBytes, b.packedBytes)} ` +
      `| ${kb(a.unpackedBytes)} | ${kb(b.unpackedBytes)} | ${delta(a.unpackedBytes, b.unpackedBytes)} ` +
      `| ${a.files} | ${b.files} |`,
  );
}
lines.push("");

// --- apps -------------------------------------------------------------------

lines.push("## App builds", "");
lines.push(
  `| Playground | Package manager | Bundle ${beforeLabel} | Bundle ${afterLabel} | Δ bundle | Gzip Δ | Install ${beforeLabel} | Install ${afterLabel} | Δ install | Build time Δ |`,
);
lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

const afterJobs = new Map(after.jobs.map((job) => [job.job, job]));

for (const beforeJob of before.jobs) {
  const afterJob = afterJobs.get(beforeJob.job);
  if (!afterJob) continue;

  const a = beforeJob.metrics;
  const b = afterJob.metrics;
  if (!a || !b) continue;

  lines.push(
    `| ${beforeJob.playground} | ${beforeJob.packageManager} ` +
      `| ${kb(a.build?.bytes)} | ${kb(b.build?.bytes)} | ${delta(a.build?.bytes, b.build?.bytes)} ` +
      `| ${delta(a.build?.gzipBytes, b.build?.gzipBytes)} ` +
      `| ${kb(a.install.bytes)} | ${kb(b.install.bytes)} | ${delta(a.install.bytes, b.install.bytes)} ` +
      `| ${seconds(beforeJob.buildMs, afterJob.buildMs)} |`,
  );
}
lines.push("");

// --- duplicated dependencies ------------------------------------------------

const fingerprintRows: string[] = [];

for (const beforeJob of before.jobs) {
  const afterJob = afterJobs.get(beforeJob.job);
  const a = beforeJob.metrics?.fingerprints;
  const b = afterJob?.metrics?.fingerprints;
  if (!a || !b) continue;

  for (const label of sortedKeys(a, b)) {
    fingerprintRows.push(
      `| ${beforeJob.playground} | ${beforeJob.packageManager} | ${label} | ${a[label] ?? 0} | ${b[label] ?? 0} |`,
    );
  }
}

if (fingerprintRows.length > 0) {
  lines.push("## Copies bundled into the app", "");
  lines.push(`| Playground | Package manager | Marker | ${beforeLabel} | ${afterLabel} |`);
  lines.push("| --- | --- | --- | ---: | ---: |");
  lines.push(...fingerprintRows);
  lines.push("");
}

// --- installed packages -----------------------------------------------------

lines.push("## Installed package footprint", "");
lines.push(
  `| Package | Playground | ${beforeLabel} | ${afterLabel} | Δ | Files ${beforeLabel} | Files ${afterLabel} |`,
);
lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: |");

const seen = new Set<string>();

for (const beforeJob of before.jobs) {
  const afterJob = afterJobs.get(beforeJob.job);
  if (!afterJob?.metrics || !beforeJob.metrics) continue;

  for (const [name, a] of Object.entries(beforeJob.metrics.packages)) {
    const b = afterJob.metrics.packages[name];
    if (!b) continue;
    const key = `${name}|${beforeJob.playground}`;
    if (seen.has(key)) continue;
    seen.add(key);

    lines.push(
      `| \`${name}\` | ${beforeJob.playground} | ${kb(a.bytes)} | ${kb(b.bytes)} | ${delta(a.bytes, b.bytes)} ` +
        `| ${a.files} | ${b.files} |`,
    );
  }
}
lines.push("");

// --- outcome differences ----------------------------------------------------

const changed = before.jobs
  .map((beforeJob) => ({ beforeJob, afterJob: afterJobs.get(beforeJob.job) }))
  .filter(({ beforeJob, afterJob }) => afterJob && afterJob.status !== beforeJob.status);

if (changed.length > 0) {
  lines.push("## Outcome changes", "");
  lines.push("| Job | Before | After |");
  lines.push("| --- | --- | --- |");
  for (const { beforeJob, afterJob } of changed) {
    lines.push(
      `| ${beforeJob.job} | ${beforeJob.status}${beforeJob.failedPhase ? ` (${beforeJob.failedPhase})` : ""} ` +
        `| ${afterJob!.status}${afterJob!.failedPhase ? ` (${afterJob!.failedPhase})` : ""} |`,
    );
  }
  lines.push("");
}

process.stdout.write(`${lines.join("\n")}\n`);

function sortedKeys(...records: Array<Record<string, unknown> | undefined>): string[] {
  return [...new Set(records.flatMap((record) => Object.keys(record ?? {})))].sort();
}

function kb(bytes: number | undefined): string {
  if (bytes === undefined) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function delta(a: number | undefined, b: number | undefined): string {
  if (a === undefined || b === undefined) return "—";
  const difference = b - a;
  if (difference === 0) return "0";
  const percent =
    a === 0 ? "" : ` (${difference > 0 ? "+" : ""}${((difference / a) * 100).toFixed(1)}%)`;
  return `${difference > 0 ? "+" : "−"}${kb(Math.abs(difference))}${percent}`;
}

function seconds(a: number | undefined, b: number | undefined): string {
  if (a === undefined || b === undefined) return "—";
  const difference = (b - a) / 1000;
  return `${difference > 0 ? "+" : ""}${difference.toFixed(1)} s`;
}
