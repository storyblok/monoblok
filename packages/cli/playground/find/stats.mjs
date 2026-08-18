#!/usr/bin/env node
/**
 * Reduces one probe log plus one CLI run report to the numbers `scenarios.sh`
 * draws, and prints them as a single JSON view model.
 *
 * Usage: node stats.mjs <probe.jsonl> <run-report.json> <stdout-lines>
 *
 * A stage's `time` is the union of its calls' intervals: overlapping calls
 * counted once, gaps between them counted not at all. Adding the calls up would
 * claim six minutes of content fetching inside a thirty second run, and measuring
 * first start to last finish would count the stretches where the stage sat idle
 * waiting on another one.
 */
import { readFileSync } from "node:fs";

/** `resource.method[tag]` → row label, where it runs, what one sample is. */
const STAGES = {
  "components.list": ["schema fetch", "server-side (MAPI)", "request"],
  "stories.list": ["list requests", "server-side (MAPI)", "page"],
  "stories.get": ["content fetch", "server-side (MAPI)", "story"],
  "stories.list.by_uuids": ["target lookups", "server-side (MAPI)", "batch"],
  "capi.stories.by_uuids": ["content prefetch", "server-side (CAPI)", "batch"],
  "jsonpath.match": ["--where filters", "client-side (local)", "evaluation"],
};

const PLURALS = { story: "stories", batch: "batches" };

const sampled = (count, unit) =>
  count === 1 ? `1 ${unit}` : `${count} ${PLURALS[unit] ?? `${unit}s`}`;

const duration = (ms) => {
  if (ms === undefined) {
    return "-";
  }
  if (ms >= 60_000) {
    return `${Math.round(ms / 6000) / 10}min`;
  }
  if (ms >= 1000) {
    return `${Math.round(ms / 10) / 100}s`;
  }
  if (ms >= 10) {
    return `${Math.round(ms)}ms`;
  }
  return `${Math.round(ms * 100) / 100}ms`;
};

/** Total time covered by at least one interval, overlaps counted once. */
const union = (intervals) => {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  let total = 0;
  let openStart = sorted[0].start;
  let openEnd = sorted[0].end;

  for (const { start, end } of sorted.slice(1)) {
    if (start > openEnd) {
      total += openEnd - openStart;
      openStart = start;
      openEnd = end;
    } else if (end > openEnd) {
      openEnd = end;
    }
  }

  return total + (openEnd - openStart);
};

/** Nearest rank: the smallest sample at or above the requested fraction. */
const percentile = (sorted, fraction) =>
  sorted[Math.min(Math.max(1, Math.ceil(fraction * sorted.length)), sorted.length) - 1];

const readRecords = (path) => {
  const grouped = new Map();
  let lines = [];
  try {
    lines = readFileSync(path, "utf8").split("\n");
  } catch {
    return grouped;
  }

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const record = JSON.parse(line);
    const key = [record.group, record.method, record.tag].filter(Boolean).join(".");
    // Insertion order is first-call order, which is the order stages ran in.
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push({ start: record.start, end: record.end });
  }

  return grouped;
};

const [probePath, reportPath, lineCount] = process.argv.slice(2);
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const summary = report.summary ?? {};
const listed = summary.listStoriesResults ?? {};
const fetched = summary.fetchContentResults ?? {};
const capiFiltered = summary.capiFilterResults;
const isCheck = summary.referenceCheckResults !== undefined;
const final = summary.filterResults ?? summary.referenceCheckResults ?? {};

const stages = [];
let content;

for (const [key, intervals] of readRecords(probePath)) {
  const [stage, runs, unit] = STAGES[key] ?? [key, "server-side (MAPI)", "call"];
  const durations = intervals.map(({ start, end }) => end - start).sort((a, b) => a - b);
  const active = union(intervals);

  stages.push({
    stage,
    runs,
    sampled: sampled(durations.length, unit),
    time: duration(active),
    median: duration(percentile(durations, 0.5)),
    p95: duration(percentile(durations, 0.95)),
  });

  if (key === "stories.get" && active > 0) {
    content = {
      time: duration(active),
      median: duration(percentile(durations, 0.5)),
      parallel: Math.round((durations.reduce((a, b) => a + b, 0) / active) * 10) / 10,
    };
  }
}

const counts = [
  { value: listed.succeeded ?? 0, label: "listed", tone: "strong", sep: "" },
  { value: fetched.succeeded ?? 0, label: "fetched", tone: "strong", sep: " → " },
  {
    value: (isCheck ? final.failed : final.succeeded) ?? 0,
    label: isCheck ? "with issues" : "kept",
    tone: "good",
    sep: " → ",
  },
];

if (final.skipped) {
  counts.push({ value: final.skipped, label: "dropped", tone: "warn", sep: " · " });
}
if (listed.skipped) {
  counts.push({ value: listed.skipped, label: "skipped before fetch", tone: "warn", sep: " · " });
}
if (capiFiltered?.skipped) {
  counts.push({ value: capiFiltered.skipped, label: "pruned by CAPI", tone: "warn", sep: " · " });
}
const failures = (listed.failed ?? 0) + (fetched.failed ?? 0);
if (failures) {
  counts.push({ value: failures, label: "failed", tone: "bad", sep: " · " });
}
counts.push({ value: Number(lineCount), label: "JSONL lines", tone: "strong", sep: " · " });

process.stdout.write(
  JSON.stringify({
    counts,
    stages,
    // The command's own duration, so the number does not include node's boot.
    wall: Math.round((report.meta?.durationMs ?? 0) / 100) / 10,
    rate: report.meta?.config?.apiRateLimit ?? 0,
    parallel: content?.parallel ?? 0,
    summary: {
      listed: listed.succeeded ?? 0,
      fetched: fetched.succeeded ?? 0,
      kept: (isCheck ? final.failed : final.succeeded) ?? 0,
      content: content?.time ?? "-",
      median: content?.median ?? "-",
    },
  }),
);
