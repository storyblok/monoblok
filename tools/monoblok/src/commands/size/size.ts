import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import zlib from "zlib";

export const CONFIG_FILE = "bundle-size.json";

/** Marks the bundle size PR comment, so CI updates it instead of adding another. */
export const COMMENT_MARKER = "<!-- monoblok-bundle-size -->";

export const DEFAULT_THRESHOLDS: Thresholds = { warn: 5, error: 10 };

// Type declarations and source maps never reach a consumer's bundle.
const IGNORED_FILE = /\.d\.[cm]?ts$|\.map$/;

export type Thresholds = {
  /** Growth over the baseline, in percent, that emits a warning. */
  warn: number;
  /** Growth over the baseline, in percent, that fails the check. */
  error: number;
};

/** Shape of a package's `bundle-size.json`. */
export type BundleSizeConfig = Partial<Thresholds> & {
  /** Glob pattern (relative to the package) mapped to its baseline gzip size in bytes. */
  entries: Record<string, number>;
};

export type SizeStatus = "ok" | "warn" | "error" | "shrunk" | "missing";

export type EntryResult = {
  pattern: string;
  files: string[];
  size: number;
  baseline: number;
  /** Baseline on the base branch, or `undefined` when the entry is new. */
  base: number | undefined;
  /** Change over the baseline, in percent. */
  change: number;
  status: SizeStatus;
};

export type PackageResult = {
  name: string;
  /** Package directory, relative to the repo root. */
  dir: string;
  thresholds: Thresholds;
  entries: EntryResult[];
};

export type ProjectConfig = {
  name: string;
  dir: string;
  config: BundleSizeConfig;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSize(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function parseConfig(raw: unknown, source: string): BundleSizeConfig {
  if (!isRecord(raw)) {
    throw new Error(`${source}: expected an object`);
  }
  if (!isRecord(raw.entries) || Object.keys(raw.entries).length === 0) {
    throw new Error(`${source}: "entries" must map at least one glob pattern to a baseline size`);
  }

  const config: BundleSizeConfig = { entries: {} };
  for (const key of ["warn", "error"] as const) {
    const value = raw[key];
    if (value === undefined) {
      continue;
    }
    if (!isSize(value)) {
      throw new Error(`${source}: "${key}" must be a non-negative number`);
    }
    config[key] = value;
  }
  for (const [pattern, baseline] of Object.entries(raw.entries)) {
    if (!isSize(baseline)) {
      throw new Error(`${source}: baseline for "${pattern}" must be a non-negative number`);
    }
    config.entries[pattern] = baseline;
  }
  return config;
}

export function resolveThresholds(config: BundleSizeConfig): Thresholds {
  const thresholds = {
    warn: config.warn ?? DEFAULT_THRESHOLDS.warn,
    error: config.error ?? DEFAULT_THRESHOLDS.error,
  };
  if (thresholds.warn > thresholds.error) {
    throw new Error(`"warn" (${thresholds.warn}%) must not exceed "error" (${thresholds.error}%)`);
  }
  return thresholds;
}

/** Finds every package that declares a `bundle-size.json`, optionally filtered by package name. */
export function loadProjects(root: string, filter: string[] = []): ProjectConfig[] {
  const projects = fs
    .globSync(`packages/*/${CONFIG_FILE}`, { cwd: root })
    .sort()
    .map((configPath) => {
      const dir = path.dirname(configPath);
      const pkg = JSON.parse(fs.readFileSync(path.join(root, dir, "package.json"), "utf8"));
      const raw = JSON.parse(fs.readFileSync(path.join(root, configPath), "utf8"));
      return { name: String(pkg.name), dir, config: parseConfig(raw, configPath) };
    });

  const unknown = filter.filter((name) => !projects.some((project) => project.name === name));
  if (unknown.length > 0) {
    throw new Error(`No ${CONFIG_FILE} found for: ${unknown.join(", ")}`);
  }
  return filter.length > 0 ? projects.filter((project) => filter.includes(project.name)) : projects;
}

/** Gzipped size of each file matching `pattern`, summed. */
export function measure(packageDir: string, pattern: string): { files: string[]; size: number } {
  const files = fs
    .globSync(pattern, { cwd: packageDir })
    .filter((file) => !IGNORED_FILE.test(file) && fs.statSync(path.join(packageDir, file)).isFile())
    .sort();
  const size = files.reduce(
    (total, file) =>
      total + zlib.gzipSync(fs.readFileSync(path.join(packageDir, file)), { level: 9 }).length,
    0,
  );
  return { files, size };
}

export function evaluate(
  size: number,
  baseline: number,
  thresholds: Thresholds,
): Pick<EntryResult, "change" | "status"> {
  const change =
    baseline === 0 ? (size === 0 ? 0 : Infinity) : ((size - baseline) / baseline) * 100;
  if (change > thresholds.error) {
    return { change, status: "error" };
  }
  if (change > thresholds.warn) {
    return { change, status: "warn" };
  }
  if (change < -thresholds.warn) {
    return { change, status: "shrunk" };
  }
  return { change, status: "ok" };
}

/**
 * Baselines a package has on `ref`, or none when it had no `bundle-size.json` there. Measured
 * sizes are compared with these in the PR comment, so a PR that also updates its baselines still
 * shows how much it grew.
 */
export function loadBaseEntries(root: string, dir: string, ref: string): Record<string, number> {
  let content: string;
  try {
    content = execFileSync("git", ["show", `${ref}:${dir}/${CONFIG_FILE}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return {};
  }
  return parseConfig(JSON.parse(content), `${ref}:${dir}/${CONFIG_FILE}`).entries;
}

export function checkProject(
  root: string,
  project: ProjectConfig,
  baseEntries: Record<string, number> = project.config.entries,
): PackageResult {
  const thresholds = resolveThresholds(project.config);
  const entries = Object.entries(project.config.entries).map(([pattern, baseline]) => {
    const base = baseEntries[pattern];
    const { files, size } = measure(path.join(root, project.dir), pattern);
    if (files.length === 0) {
      return { pattern, files, size, baseline, base, change: -100, status: "missing" as const };
    }
    return { pattern, files, size, baseline, base, ...evaluate(size, baseline, thresholds) };
  });
  return { name: project.name, dir: project.dir, thresholds, entries };
}

/** Returns the config with every baseline set to the current size. */
export function updateBaselines(root: string, project: ProjectConfig): BundleSizeConfig {
  const entries = Object.fromEntries(
    Object.keys(project.config.entries).map((pattern) => {
      const { files, size } = measure(path.join(root, project.dir), pattern);
      if (files.length === 0) {
        throw new Error(
          `${project.name}: no files match "${pattern}". Build the package before updating.`,
        );
      }
      return [pattern, size];
    }),
  );
  return { ...project.config, entries };
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} kB`;
}

export function formatChange(change: number): string {
  if (!Number.isFinite(change)) {
    return "new";
  }
  const rounded = change.toFixed(1);
  return change > 0 ? `+${rounded}%` : `${rounded}%`;
}

export function describe(result: PackageResult, entry: EntryResult): string {
  const subject = `${result.name} (${entry.pattern})`;
  switch (entry.status) {
    case "missing":
      return `${subject}: no files match. Build the package, or fix the pattern in ${CONFIG_FILE}.`;
    case "error":
    case "warn":
      return `${subject} grew ${formatChange(entry.change)} to ${formatBytes(entry.size)} gzip (baseline ${formatBytes(entry.baseline)}, ${entry.status} threshold ${result.thresholds[entry.status]}%). If the growth is intended, run \`pnpm monoblok size update ${result.name}\` and commit the new baseline.`;
    case "shrunk":
      return `${subject} shrank ${formatChange(entry.change)} to ${formatBytes(entry.size)} gzip. Run \`pnpm monoblok size update ${result.name}\` to lock in the new baseline.`;
    default:
      return `${subject}: ${formatBytes(entry.size)} gzip`;
  }
}

export function formatDelta(size: number, base: number | undefined): string {
  if (base === undefined) {
    return "new";
  }
  if (size === base) {
    return "0 B";
  }
  const bytes = `${size > base ? "+" : "-"}${formatBytes(Math.abs(size - base))}`;
  return base === 0 ? bytes : `${bytes} (${formatChange(((size - base) / base) * 100)})`;
}

const STATUS_LABEL: Record<SizeStatus, string> = {
  ok: "✅ ok",
  warn: "⚠️ warn",
  error: "❌ error",
  shrunk: "📉 shrunk",
  missing: "❌ missing",
};

function toTable(rows: Array<[PackageResult, EntryResult]>, baseLabel: string): string[] {
  return [
    `| Package | Files | ${baseLabel} | This branch | Change | Status |`,
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...rows.map(
      ([result, entry]) =>
        `| \`${result.name}\` | \`${entry.pattern}\` | ${entry.base === undefined ? "–" : formatBytes(entry.base)} | ${formatBytes(entry.size)} | ${formatDelta(entry.size, entry.base)} | ${STATUS_LABEL[entry.status]} |`,
    ),
  ];
}

/**
 * Markdown report for the PR comment and the job summary: the entries whose size differs from
 * `baseLabel` up front, every entry in a collapsed table below.
 */
export function toMarkdown(results: PackageResult[], baseLabel = "Baseline"): string {
  const rows = results.flatMap((result) =>
    result.entries.map((entry): [PackageResult, EntryResult] => [result, entry]),
  );
  const changed = rows.filter(([, entry]) => entry.size !== entry.base);
  const failed = rows.some(([, entry]) => entry.status === "error" || entry.status === "missing");

  return [
    COMMENT_MARKER,
    "## 📦 Bundle size",
    "",
    changed.length === 0
      ? `No package changed size compared with \`${baseLabel}\`.`
      : `${changed.length} of ${rows.length} entries changed size compared with \`${baseLabel}\`. Sizes are gzipped build output.`,
    "",
    ...(changed.length > 0 ? [...toTable(changed, baseLabel), ""] : []),
    ...(failed
      ? [
          "> [!CAUTION]",
          "> An entry is past its error threshold or matches no files. If the growth is intended, run `pnpm monoblok size update <package>` and commit the new baseline.",
          "",
        ]
      : []),
    "<details>",
    "<summary>All packages</summary>",
    "",
    ...toTable(rows, baseLabel),
    "",
    "</details>",
    "",
  ].join("\n");
}
