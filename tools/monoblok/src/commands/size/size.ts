import fs from "fs";
import path from "path";
import zlib from "zlib";
import { init, parse } from "es-module-lexer";

/** Packages that never reach a browser. Every other package under `packages/` is measured. */
export const IGNORED_PACKAGES: readonly string[] = ["storyblok", "@storyblok/lint-config"];

/** Marks the bundle size PR comment, so CI updates it instead of adding another. */
export const COMMENT_MARKER = "<!-- monoblok-bundle-size -->";

/** PR label that turns growth past the thresholds into a warning. */
export const ACCEPT_LABEL = "bundle-size-accepted";

export type Format = "esm" | "cjs" | "umd" | "css";

/** CommonJS is what Node loads, not what a browser receives, so its growth is reported but never fails the check. */
export const REPORT_ONLY_FORMATS: readonly Format[] = ["cjs"];

export type Kind = "entry" | "total" | "file";

export type Threshold = {
  /** Growth over the base, in percent. */
  percent: number;
  /** Growth over the base, in bytes. Keeps a small file from failing on a few bytes. */
  bytes: number;
};

/** Growth fails the check only when it is past both the percent and the bytes. */
export const THRESHOLDS: Record<Kind, Threshold> = {
  entry: { percent: 5, bytes: 200 },
  total: { percent: 5, bytes: 200 },
  file: { percent: 5, bytes: 500 },
};

export type Measured = {
  format: Format;
  /** Gzipped size in bytes. */
  size: number;
};

export type PackageMeasurement = {
  /** Package directory, relative to the measured root. */
  dir: string;
  /**
   * Each file `exports` points to, with the files it statically imports from the package: what a
   * consumer loads for that import. Keyed by subpath and format, e.g. `./ssr (esm)`.
   */
  entries: Record<string, Measured & { files: string[] }>;
  /** Every file in `dist`, summed per format. Keyed by format. */
  totals: Record<string, Measured>;
  /** Every file in `dist`, keyed by its path relative to the package. */
  files: Record<string, Measured>;
  /** Set when the package could not be measured, e.g. because it is not built. */
  error?: string;
};

export type Measurement = {
  packages: Record<string, PackageMeasurement>;
};

export type ProjectConfig = {
  name: string;
  /** Package directory, relative to the measured root. */
  dir: string;
};

// Type declarations, source maps, and tests never reach a consumer's bundle.
const MEASURED_FILE = /\.(m?js|cjs|css|ts|vue|svelte|astro)$/;
const IGNORED_FILE = /\.d\.[cm]?ts$|\.(spec|test)\./;
const RESOLVED_EXTENSIONS = [".mjs", ".js", ".cjs"];
const ENTRY_FIELDS = ["main", "module", "browser", "unpkg", "jsdelivr"] as const;

// Lexes CommonJS, UMD, and anything es-module-lexer cannot parse, such as `.astro` frontmatter.
// Only relative specifiers matter: bare ones are dependencies the consumer installs.
const REQUIRE = /\brequire\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;
const STATIC_IMPORT =
  /(?:^|[\s;}])(?:import|export)\s+(?!type\s)(?:[^"'`;]*?\sfrom\s*)?["'](\.{1,2}\/[^"']+)["']/g;

type PackageJson = Record<string, unknown> & { name?: unknown; type?: unknown; exports?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}

function readPackageJson(root: string, dir: string): PackageJson {
  const raw: unknown = JSON.parse(fs.readFileSync(path.join(root, dir, "package.json"), "utf8"));
  if (!isRecord(raw)) {
    throw new Error(`${dir}/package.json: expected an object`);
  }
  return raw;
}

/** Every package under `packages/` except the ignored ones, optionally filtered by package name. */
export function loadProjects(root: string, filter: string[] = []): ProjectConfig[] {
  const projects = fs
    .globSync("packages/*/package.json", { cwd: root })
    .map((file) => toPosix(path.dirname(file)))
    .sort()
    .map((dir) => ({ name: String(readPackageJson(root, dir).name), dir }))
    .filter((project) => !IGNORED_PACKAGES.includes(project.name));
  if (projects.length === 0) {
    throw new Error(`No packages found in ${path.join(root, "packages")}`);
  }

  const unknown = filter.filter((name) => !projects.some((project) => project.name === name));
  if (unknown.length > 0) {
    throw new Error(`Not a measured package: ${unknown.join(", ")}`);
  }
  return filter.length > 0 ? projects.filter((project) => filter.includes(project.name)) : projects;
}

export function formatOf(file: string, pkg: PackageJson): Format {
  if (file.endsWith(".css")) {
    return "css";
  }
  if (/\.(umd|iife)\.js$/.test(file)) {
    return "umd";
  }
  if (file.endsWith(".cjs") || (file.endsWith(".js") && pkg.type !== "module")) {
    return "cjs";
  }
  return "esm";
}

/** Each subpath with a file it points to, from `exports` and the legacy entry fields. */
export function entryPoints(pkg: PackageJson): Array<{ subpath: string; file: string }> {
  const points: Array<{ subpath: string; file: string }> = [];
  const collect = (subpath: string, target: unknown): void => {
    if (typeof target === "string") {
      points.push({ subpath, file: path.posix.normalize(target) });
    } else if (Array.isArray(target)) {
      for (const item of target) {
        collect(subpath, item);
      }
    } else if (isRecord(target)) {
      for (const [condition, value] of Object.entries(target)) {
        if (condition !== "types") {
          collect(subpath, value);
        }
      }
    }
  };

  const { exports } = pkg;
  if (isRecord(exports) && Object.keys(exports).some((key) => key.startsWith("."))) {
    for (const [subpath, target] of Object.entries(exports)) {
      // A pattern subpath maps to many files: those are covered by the totals.
      if (!subpath.includes("*")) {
        collect(subpath, target);
      }
    }
  } else if (exports !== undefined) {
    collect(".", exports);
  }
  for (const field of ENTRY_FIELDS) {
    collect(".", pkg[field]);
  }
  return points.filter(({ file }) => file.startsWith("dist/") && isMeasured(file));
}

function isMeasured(file: string): boolean {
  return MEASURED_FILE.test(file) && !IGNORED_FILE.test(file);
}

function matchesFilesEntry(file: string, pattern: string): boolean {
  const normalized = path.posix.normalize(pattern).replace(/\/$/, "");
  return (
    file === normalized ||
    file.startsWith(`${normalized}/`) ||
    path.posix.matchesGlob(file, normalized)
  );
}

/** Whether `files` in `package.json` publishes the file. Without `files`, everything is published. */
export function isPublished(file: string, pkg: PackageJson): boolean {
  if (!Array.isArray(pkg.files)) {
    return true;
  }
  const patterns = pkg.files.filter((pattern) => typeof pattern === "string");
  const included = patterns.some(
    (pattern) => !pattern.startsWith("!") && matchesFilesEntry(file, pattern),
  );
  return (
    included &&
    !patterns.some(
      (pattern) => pattern.startsWith("!") && matchesFilesEntry(file, pattern.slice(1)),
    )
  );
}

function isFile(file: string): boolean {
  return fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
}

/** Relative specifiers a file imports statically. Dynamic imports load lazily, so they are left out. */
export function relativeImports(file: string, source: string, format: Format): string[] {
  if (format === "cjs" || format === "umd") {
    return [...source.matchAll(REQUIRE)].map((match) => match[1]);
  }
  if (format === "esm" && /\.(m?js|ts)$/.test(file)) {
    try {
      const [imports] = parse(source);
      return imports.flatMap((item) =>
        (item.type === "static" || item.type === "reexport-star") &&
        !item.typeOnly &&
        item.specifier?.startsWith(".")
          ? [item.specifier]
          : [],
      );
    } catch {
      // Not plain JavaScript: fall back to the pattern below.
    }
  }
  return [...source.matchAll(STATIC_IMPORT)].map((match) => match[1]);
}

function resolveImport(packageDir: string, from: string, specifier: string): string | undefined {
  const target = path.posix.join(path.posix.dirname(from), specifier.replace(/[?#].*$/, ""));
  const candidates = [
    target,
    ...RESOLVED_EXTENSIONS.map((extension) => `${target}${extension}`),
    ...RESOLVED_EXTENSIONS.map((extension) => `${target}/index${extension}`),
  ];
  return candidates.find(
    (candidate) => candidate.startsWith("dist/") && isFile(path.join(packageDir, candidate)),
  );
}

export async function measurePackage(
  root: string,
  project: ProjectConfig,
): Promise<PackageMeasurement> {
  const packageDir = path.join(root, project.dir);
  const result: PackageMeasurement = { dir: project.dir, entries: {}, totals: {}, files: {} };
  if (!fs.existsSync(path.join(packageDir, "dist"))) {
    return { ...result, error: "No `dist` directory. Build the package first." };
  }
  await init;
  const pkg = readPackageJson(root, project.dir);

  const sizes = new Map<string, number>();
  const sizeOf = (file: string): number => {
    let size = sizes.get(file);
    if (size === undefined) {
      size = zlib.gzipSync(fs.readFileSync(path.join(packageDir, file)), { level: 9 }).length;
      sizes.set(file, size);
    }
    return size;
  };

  const files = fs
    .globSync("dist/**/*", { cwd: packageDir })
    .map(toPosix)
    .filter(
      (file) => isMeasured(file) && isPublished(file, pkg) && isFile(path.join(packageDir, file)),
    )
    .sort();
  for (const file of files) {
    const format = formatOf(file, pkg);
    const size = sizeOf(file);
    result.files[file] = { format, size };
    const total = (result.totals[format] ??= { format, size: 0 });
    total.size += size;
  }

  const seen = new Set<string>();
  for (const { subpath, file } of entryPoints(pkg)) {
    if (seen.has(file)) {
      continue;
    }
    seen.add(file);
    if (!isFile(path.join(packageDir, file))) {
      return {
        ...result,
        error: `\`${subpath}\` points to ${file}, which the build did not emit.`,
      };
    }

    const format = formatOf(file, pkg);
    const graph = new Set<string>();
    const visit = (current: string): void => {
      if (graph.has(current)) {
        return;
      }
      graph.add(current);
      const source = fs.readFileSync(path.join(packageDir, current), "utf8");
      for (const specifier of relativeImports(current, source, formatOf(current, pkg))) {
        const resolved = resolveImport(packageDir, current, specifier);
        if (resolved && isMeasured(resolved)) {
          visit(resolved);
        }
      }
    };
    visit(file);

    let key = `${subpath} (${format})`;
    if (result.entries[key]) {
      key = `${subpath} (${file})`;
    }
    const entryFiles = [...graph].sort();
    result.entries[key] = {
      format,
      size: entryFiles.reduce((total, current) => total + sizeOf(current), 0),
      files: entryFiles,
    };
  }
  return result;
}

export async function measure(root: string, filter: string[] = []): Promise<Measurement> {
  const packages: Record<string, PackageMeasurement> = {};
  for (const project of loadProjects(root, filter)) {
    packages[project.name] = await measurePackage(root, project);
  }
  return { packages };
}

// Written by `measure`, so its shape is trusted past the top level.
function isMeasurement(value: unknown): value is Measurement {
  return isRecord(value) && isRecord(value.packages);
}

export function readMeasurement(file: string): Measurement {
  const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!isMeasurement(raw)) {
    throw new Error(`${file}: not a bundle size measurement`);
  }
  return raw;
}

/**
 * `no-base`: the base build has no measurement of the package, so nothing is compared.
 * `over`: grew past the threshold. `new` and `removed` are entries, totals, or files that only
 * one of the builds has.
 */
export type ChangeStatus = "ok" | "over" | "new" | "removed" | "no-base";

export type Change = {
  package: string;
  kind: Kind;
  name: string;
  format: Format;
  /** Size on this branch, `undefined` when removed. */
  size: number | undefined;
  /** Size on the base, `undefined` when new or without a base. */
  base: number | undefined;
  status: ChangeStatus;
  /** Whether the change fails the check. */
  blocking: boolean;
};

export type Comparison = {
  changes: Change[];
  /** Packages this branch could not measure. These always fail the check. */
  errors: Array<{ package: string; message: string }>;
};

const KIND_ITEMS: Array<[Kind, "entries" | "totals" | "files"]> = [
  ["entry", "entries"],
  ["total", "totals"],
  ["file", "files"],
];

export function isOver(size: number, base: number, threshold: Threshold): boolean {
  const growth = size - base;
  const percent = base === 0 ? Infinity : (growth / base) * 100;
  return growth > threshold.bytes && percent > threshold.percent;
}

export function compare(head: Measurement, base: Measurement | undefined): Comparison {
  const comparison: Comparison = { changes: [], errors: [] };
  for (const [name, measured] of Object.entries(head.packages)) {
    if (measured.error) {
      comparison.errors.push({ package: name, message: measured.error });
      continue;
    }
    const baseMeasured = base?.packages[name];
    const hasBase = baseMeasured !== undefined && !baseMeasured.error;

    for (const [kind, items] of KIND_ITEMS) {
      const headItems = measured[items];
      const baseItems = hasBase ? baseMeasured[items] : {};
      for (const [itemName, item] of Object.entries(headItems)) {
        const baseSize = baseItems[itemName]?.size;
        let status: ChangeStatus = "ok";
        if (!hasBase) {
          status = "no-base";
        } else if (baseSize === undefined) {
          status = "new";
        } else if (isOver(item.size, baseSize, THRESHOLDS[kind])) {
          status = "over";
        }
        comparison.changes.push({
          package: name,
          kind,
          name: itemName,
          format: item.format,
          size: item.size,
          base: baseSize,
          status,
          blocking: status === "over" && !REPORT_ONLY_FORMATS.includes(item.format),
        });
      }
      for (const [itemName, item] of Object.entries(baseItems)) {
        if (!(itemName in headItems)) {
          comparison.changes.push({
            package: name,
            kind,
            name: itemName,
            format: item.format,
            size: undefined,
            base: item.size,
            status: "removed",
            blocking: false,
          });
        }
      }
    }
  }
  return comparison;
}

/** Whether the comparison fails the check. Accepted growth passes, a package that is not built never does. */
export function hasFailed(comparison: Comparison, accepted = false): boolean {
  return (
    comparison.errors.length > 0 ||
    (!accepted && comparison.changes.some((change) => change.blocking))
  );
}

/** Whether a change is worth listing outside the collapsed full table. */
export function isChanged(change: Change): boolean {
  return change.status !== "no-base" && change.size !== change.base;
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

export function formatDelta(size: number | undefined, base: number | undefined): string {
  if (size === undefined) {
    return "removed";
  }
  if (base === undefined) {
    return "new";
  }
  if (size === base) {
    return "0 B";
  }
  const bytes = `${size > base ? "+" : "-"}${formatBytes(Math.abs(size - base))}`;
  return base === 0 ? bytes : `${bytes} (${formatChange(((size - base) / base) * 100)})`;
}

export function label(change: Change): string {
  return change.kind === "total" ? `total (${change.format})` : change.name;
}

export function describe(change: Change): string {
  const threshold = THRESHOLDS[change.kind];
  return `${change.package} ${label(change)} grew ${formatDelta(change.size, change.base)} to ${formatBytes(change.size ?? 0)} gzip, past the ${threshold.percent}% and ${formatBytes(threshold.bytes)} threshold.`;
}

const STATUS_LABEL: Record<ChangeStatus, string> = {
  ok: "",
  over: "❌ over",
  new: "🆕 new",
  removed: "🗑️ removed",
  "no-base": "",
};

function statusLabel(change: Change): string {
  if (change.status === "over" && !change.blocking) {
    return "⚠️ over (CommonJS)";
  }
  return STATUS_LABEL[change.status];
}

function toTable(changes: Change[], baseLabel: string, nameHeader: string): string[] {
  return [
    `| Package | ${nameHeader} | ${baseLabel} | This branch | Change | |`,
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...changes.map(
      (change) =>
        `| \`${change.package}\` | \`${label(change)}\` | ${change.base === undefined ? "–" : formatBytes(change.base)} | ${change.size === undefined ? "–" : formatBytes(change.size)} | ${change.status === "no-base" ? "–" : formatDelta(change.size, change.base)} | ${statusLabel(change)} |`,
    ),
  ];
}

/**
 * Markdown report for the PR comment and the job summary: the entries and totals that changed up
 * front, files past the threshold below them, and every entry and total in a collapsed table.
 */
export function toMarkdown(comparison: Comparison, baseLabel = "Base", accepted = false): string {
  const { changes, errors } = comparison;
  const summary = changes.filter((change) => change.kind !== "file");
  const changed = summary.filter(isChanged);
  const files = changes.filter((change) => change.kind === "file" && change.status === "over");
  const blocking = changes.some((change) => change.blocking);
  const hasBase = changes.some((change) => change.status !== "no-base");
  const { entry, file } = THRESHOLDS;

  let intro: string;
  if (!hasBase) {
    intro = `No measurement of \`${baseLabel}\` to compare with, so only this branch's sizes are listed.`;
  } else if (changed.length === 0) {
    intro = `No package changed size compared with \`${baseLabel}\`.`;
  } else {
    intro = `${changed.length} of ${summary.length} entries and totals changed size compared with \`${baseLabel}\`.`;
  }

  return [
    COMMENT_MARKER,
    "## 📦 Bundle size",
    "",
    intro,
    "",
    ...(changed.length > 0 ? [...toTable(changed, baseLabel, "Entry"), ""] : []),
    ...(files.length > 0
      ? ["Files past the threshold:", "", ...toTable(files, baseLabel, "File"), ""]
      : []),
    ...(errors.length > 0
      ? [
          "> [!CAUTION]",
          "> Some packages could not be measured:",
          ...errors.map((error) => `> - \`${error.package}\`: ${error.message}`),
          "",
        ]
      : []),
    ...(blocking && !accepted
      ? [
          "> [!CAUTION]",
          `> Some sizes grew past the threshold. If the growth is intended, add the \`${ACCEPT_LABEL}\` label to the PR and re-run the failed bundle size job.`,
          "",
        ]
      : []),
    ...(blocking && accepted
      ? [
          "> [!NOTE]",
          `> Growth past the threshold is accepted with the \`${ACCEPT_LABEL}\` label.`,
          "",
        ]
      : []),
    `<sub>Gzipped sizes. An entry is the file an export points to plus the files it statically imports from the package. An entry or total fails when it grows more than ${entry.percent}% and ${formatBytes(entry.bytes)}, a file more than ${file.percent}% and ${formatBytes(file.bytes)}. CommonJS is reported but never fails.</sub>`,
    "",
    "<details>",
    "<summary>All entries and totals</summary>",
    "",
    ...toTable(summary, baseLabel, "Entry"),
    "",
    "</details>",
    "",
  ].join("\n");
}
