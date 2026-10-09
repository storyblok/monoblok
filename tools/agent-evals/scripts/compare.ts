import fs from "node:fs";
import path from "node:path";
import { ARM_NAMES } from "../src/arms.ts";
import { GRADE_PATH, gradePasses, readGrade } from "../src/grade.ts";

export type Row = {
  skill: string;
  arm: string;
  runs: number;
  /** Null when the skill has no objective checks (e.g. CLI scenarios). */
  objectivePassRate: number | null;
  meanAxisScore: number | null;
  meanCostUsd: number | null;
  meanTokens: number | null;
};

type RunMetrics = {
  passed: boolean;
  axisScore?: number;
  costUsd?: number;
  tokens?: number;
};

type Group = { skill: string; arm: string; hasObjectiveChecks: boolean; runs: RunMetrics[] };

const UNGRADED_SCENARIO_PREFIXES = ["cli/", "spec/"];

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value))
    : {};
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function tokensOf(usage: unknown): number | undefined {
  const { input, output } = asRecord(usage);
  return typeof input === "number" && typeof output === "number" ? input + output : undefined;
}

function skillOf(scenarioKey: string): string {
  return scenarioKey.split("@")[0].split("/").at(-1) ?? scenarioKey;
}

function artifactsDir(
  reportDir: string,
  key: string,
  agent: string,
  runCount: number,
  runIndex: number,
): string {
  const pair = path.join(reportDir, "scenarios", key, agent);
  return runCount > 1
    ? path.join(pair, `run-${runIndex}`, "artifacts")
    : path.join(pair, "artifacts");
}

function metricsOf(run: Record<string, unknown>, passed: boolean): RunMetrics {
  return {
    passed,
    axisScore: num(run.axisScore) ?? num(asRecord(run.score).axisScore),
    costUsd: num(run.totalCostUsd),
    tokens: tokensOf(run.tokenUsage),
  };
}

function mean(values: (number | undefined)[]): number | null {
  const defined = values.filter((v): v is number => v !== undefined);
  return defined.length === 0 ? null : defined.reduce((a, b) => a + b, 0) / defined.length;
}

function readManifestResults(reportDir: string): Record<string, unknown>[] {
  const manifest = asRecord(
    JSON.parse(fs.readFileSync(path.join(reportDir, "report.json"), "utf8")),
  );
  return Array.isArray(manifest.results) ? manifest.results.map(asRecord) : [];
}

export function summarize(reportDir: string): Row[] {
  const groups = new Map<string, Group>();
  for (const entry of readManifestResults(reportDir)) {
    const key = str(entry.scenarioKey);
    const arm = str(entry.agentName);
    const skill = skillOf(key);
    const group = groups.get(`${skill}\0${arm}`) ?? {
      skill,
      arm,
      hasObjectiveChecks: !UNGRADED_SCENARIO_PREFIXES.some((p) => key.startsWith(p)),
      runs: [],
    };
    const runCount = num(entry.runCount) ?? 1;
    const runs = Array.isArray(entry.runs) ? entry.runs.map(asRecord) : [entry];
    runs.forEach((run, i) => {
      const dir = artifactsDir(reportDir, key, arm, runCount, num(run.runIndex) ?? i + 1);
      const grade = readGrade(path.join(dir, GRADE_PATH));
      group.runs.push(metricsOf(run, gradePasses(grade)));
    });
    groups.set(`${skill}\0${arm}`, group);
  }
  const armRank = (arm: string): number => {
    const rank = (ARM_NAMES as readonly string[]).indexOf(arm);
    return rank === -1 ? ARM_NAMES.length : rank;
  };
  return [...groups.values()]
    .sort((a, b) => a.skill.localeCompare(b.skill) || armRank(a.arm) - armRank(b.arm))
    .map((g) => ({
      skill: g.skill,
      arm: g.arm,
      runs: g.runs.length,
      objectivePassRate: g.hasObjectiveChecks
        ? g.runs.filter((r) => r.passed).length / g.runs.length
        : null,
      meanAxisScore: mean(g.runs.map((r) => r.axisScore)),
      meanCostUsd: mean(g.runs.map((r) => r.costUsd)),
      meanTokens: mean(g.runs.map((r) => r.tokens)),
    }));
}

function formatTokens(tokens: number): string {
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : String(Math.round(tokens));
}

function cell<T>(value: T | null, format: (v: T) => string): string {
  return value === null ? "n/a" : format(value);
}

export function renderMarkdown(rows: Row[]): string {
  const lines = [
    "| Skill | Arm | Runs | Objective pass | AXIS score | Cost (USD) | Tokens |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((r) =>
      [
        r.skill,
        r.arm,
        r.runs,
        cell(r.objectivePassRate, (v) => `${Math.round(v * 100)}%`),
        cell(r.meanAxisScore, (v) => v.toFixed(1)),
        cell(r.meanCostUsd, (v) => v.toFixed(2)),
        cell(r.meanTokens, formatTokens),
      ].reduce<string>((line, c) => `${line} ${c} |`, "|"),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

if (import.meta.main) {
  const reportDir = process.env.AXIS_REPORT_DIR;
  if (!reportDir) throw new Error("AXIS_REPORT_DIR is not set");
  const markdown = renderMarkdown(summarize(reportDir));
  fs.writeFileSync(path.join(reportDir, "comparison.md"), markdown);
  process.stdout.write(markdown);
}
