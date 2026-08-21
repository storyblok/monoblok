import { writeFileSync } from "node:fs";
import path from "node:path";

import type { JobResult } from "./run.ts";
import type { PackFinding, TarballMetrics } from "./verify-pack.ts";

export type Report = {
  startedAt: string;
  tier: string;
  resolvedPackageManagerVersions: Record<string, string>;
  packedVersions: Record<string, string>;
  tarballMetrics: Record<string, TarballMetrics>;
  packFindings: PackFinding[];
  neutralizedAliases: Record<string, string[]>;
  jobs: JobResult[];
};

export function writeReport(report: Report, outDir: string): { json: string; markdown: string } {
  const jsonPath = path.join(outDir, "report.json");
  const markdownPath = path.join(outDir, "report.md");

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath, renderMarkdown(report));

  return { json: jsonPath, markdown: markdownPath };
}

function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  const failed = report.jobs.filter((job) => job.status === "failed");

  lines.push(`# Playground matrix — ${report.tier}`, "");
  lines.push(`Started ${report.startedAt}`, "");
  lines.push(`**${report.jobs.length - failed.length}/${report.jobs.length} jobs passed.**`, "");

  lines.push("## Package manager versions", "");
  for (const [requested, resolved] of Object.entries(report.resolvedPackageManagerVersions)) {
    lines.push(`- \`${requested}\` → \`${resolved}\``);
  }
  lines.push("");

  if (report.packFindings.length > 0) {
    lines.push("## Tarball findings", "");
    for (const finding of report.packFindings) {
      lines.push(`- **${finding.level}** \`${finding.package}\`: ${finding.message}`);
    }
    lines.push("");
  }

  if (Object.keys(report.neutralizedAliases).length > 0) {
    lines.push("## Source aliases removed while staging", "");
    lines.push(
      "These playgrounds alias the package to its TypeScript source in place, which",
      "bypasses the build entirely. Staging drops those aliases so the install under",
      "test is the tarball.",
      "",
    );
    for (const [id, files] of Object.entries(report.neutralizedAliases)) {
      lines.push(`- \`${id}\`: ${files.map((file) => `\`${file}\``).join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Matrix", "");
  lines.push("| Playground | Package manager | Node | Result | Failed phase | Duration |");
  lines.push("| --- | --- | --- | --- | --- | --- |");

  for (const job of report.jobs) {
    lines.push(
      `| ${job.playground} | ${job.packageManager} | ${job.node} | ${job.status === "passed" ? "pass" : "**fail**"} ` +
        `| ${job.failedPhase ?? "—"} | ${(job.durationMs / 1000).toFixed(0)}s |`,
    );
  }
  lines.push("");

  const withFindings = report.jobs.filter(
    (job) => job.verify.length > 0 || (job.smoke && job.smoke.problems.length > 0),
  );

  if (withFindings.length > 0) {
    lines.push("## Details", "");
    for (const job of withFindings) {
      lines.push(`### ${job.job}`, "");
      for (const finding of job.verify) {
        lines.push(`- **${finding.level}** (${finding.check}) ${finding.message}`);
      }
      for (const problem of job.smoke?.problems ?? []) {
        lines.push(`- **smoke** ${problem}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderConsoleSummary(report: Report): string {
  const failed = report.jobs.filter((job) => job.status === "failed");
  const byPhase = new Map<string, number>();

  for (const job of failed) {
    const phase = job.failedPhase ?? "unknown";
    byPhase.set(phase, (byPhase.get(phase) ?? 0) + 1);
  }

  const lines = [`${report.jobs.length - failed.length}/${report.jobs.length} jobs passed`];

  if (report.packFindings.length > 0) {
    lines.push(`${report.packFindings.length} tarball finding(s)`);
  }

  for (const [phase, count] of byPhase) {
    lines.push(`  ${count} failed at ${phase}`);
  }

  return lines.join("\n");
}
