import fs from "fs";
import { builtinModules, createRequire } from "module";
import path from "path";
import { pathToFileURL } from "url";
import zlib from "zlib";
import { build, type OutputChunk, type Plugin } from "rolldown";

/** Packages that never reach a browser. Every other package under `packages/` is measured. */
export const IGNORED_PACKAGES: readonly string[] = [
  "storyblok",
  "@storyblok/lint-config",
  "@storyblok/migrations",
];

/**
 * Exports that only run at build time, so neither a browser nor a server bundle includes them.
 * Exports of `.astro` components are skipped too: Astro compiles them, not a bundler.
 */
export const IGNORED_EXPORTS: Readonly<Record<string, readonly string[]>> = {
  "@storyblok/nuxt": ["."],
  "@storyblok/richtext": ["./html-parser", "./markdown-parser"],
};

/** Browser entry points that `exports` does not list, such as a plugin a framework module injects. */
export const EXTRA_ENTRIES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "@storyblok/nuxt": { "runtime/plugin": "dist/runtime/plugin.js" },
};

/** Marks the bundle size PR comment, so CI updates it instead of adding another. */
export const COMMENT_MARKER = "<!-- monoblok-bundle-size -->";

/** PR label that turns growth past the threshold into a warning. */
export const ACCEPT_LABEL = "bundle-size-accepted";

export type Kind = "entry" | "file";

/** Growth over the base, in percent, past which an entry or a file fails the check. */
export const THRESHOLD_PERCENT = 5;

export type Measured = {
  /** Gzipped size in bytes. */
  size: number;
};

export type EntryMeasurement = Measured & {
  /** Packages bundled into the entry, besides the measured one. */
  dependencies: string[];
};

export type PackageMeasurement = {
  /** Package directory, relative to the measured root. */
  dir: string;
  /**
   * What a consumer's browser downloads for each export: the export bundled with its dependencies,
   * minified, without peer dependencies or lazily imported chunks. Keyed by subpath, e.g. `./ssr`.
   */
  entries: Record<string, EntryMeasurement>;
  /** Every published file in `dist` on its own, keyed by its path relative to the package. */
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

// Only ESM is measured: what apps bundle. Type declarations, source maps, and tests never reach
// a consumer's bundle.
const MEASURED_FILE = /\.(m?js|ts|vue|svelte)$/;
const IGNORED_FILE = /\.d\.[cm]?ts$|\.(spec|test)\./;
const ENTRY_FIELDS = ["main", "module", "browser"] as const;
const BUILTINS = new Set(builtinModules);

type PackageJson = Record<string, unknown> & { name?: unknown; type?: unknown; exports?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}

function readJson(file: string): PackageJson {
  const raw: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!isRecord(raw)) {
    throw new Error(`${file}: expected an object`);
  }
  return raw;
}

/** Every package under `packages/` except the ignored ones, optionally filtered by package name. */
export function loadProjects(root: string, filter: string[] = []): ProjectConfig[] {
  const projects = fs
    .globSync("packages/*/package.json", { cwd: root })
    .map((file) => toPosix(path.dirname(file)))
    .sort()
    .map((dir) => ({ name: String(readJson(path.join(root, dir, "package.json")).name), dir }))
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

/** Whether the file is an ES module: not CommonJS, nor a UMD or IIFE build. */
export function isEsm(file: string, pkg: PackageJson): boolean {
  if (/\.(umd|iife)\.js$/.test(file)) {
    return false;
  }
  return !(file.endsWith(".cjs") || (file.endsWith(".js") && pkg.type !== "module"));
}

/** Each subpath with a file it points to, from `exports`, the legacy entry fields, and `EXTRA_ENTRIES`. */
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
        if (condition !== "types" && condition !== "require") {
          collect(subpath, value);
        }
      }
    }
  };

  const name = String(pkg.name);
  // Listed first, so a package without a `.` export shows its extra entry as its main one.
  for (const [subpath, file] of Object.entries(EXTRA_ENTRIES[name] ?? {})) {
    points.push({ subpath, file });
  }

  const { exports } = pkg;
  if (isRecord(exports) && Object.keys(exports).some((key) => key.startsWith("."))) {
    for (const [subpath, target] of Object.entries(exports)) {
      // A pattern subpath maps to many files: the per-file check covers those.
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

  const ignored = IGNORED_EXPORTS[name] ?? [];
  return points.filter(
    ({ subpath, file }) =>
      file.startsWith("dist/") && isMeasured(file) && !ignored.includes(subpath),
  );
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

function gzipSize(content: string | Uint8Array): number {
  return zlib.gzipSync(content, { level: 9 }).length;
}

/** `@scope/name/sub` → `@scope/name`, or `undefined` for a relative, absolute, or virtual specifier. */
export function packageNameOf(specifier: string): string | undefined {
  if (/^[./#\0]/.test(specifier) || specifier.includes(":")) {
    return undefined;
  }
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** Finds the `package.json` that owns a file, caching each directory's answer. */
function createPackageLookup(): (file: string) => PackageJson | undefined {
  const cache = new Map<string, PackageJson | undefined>();
  const lookup = (dir: string): PackageJson | undefined => {
    if (cache.has(dir)) {
      return cache.get(dir);
    }
    const file = path.join(dir, "package.json");
    let pkg: PackageJson | undefined;
    if (isFile(file)) {
      const json = readJson(file);
      // Nested `package.json` files that only set `type` are not packages.
      pkg = typeof json.name === "string" ? json : undefined;
    }
    const parent = path.dirname(dir);
    if (!pkg && parent !== dir) {
      pkg = lookup(parent);
    }
    cache.set(dir, pkg);
    return pkg;
  };
  return (file) => lookup(path.dirname(file));
}

/** Compiles `.svelte` components with the Svelte the package itself depends on. */
function svelteCompiler(packageDir: string): Plugin {
  let compile: ((source: string, options: Record<string, unknown>) => unknown) | undefined;
  return {
    name: "monoblok-size-svelte",
    async transform(code, id) {
      if (!id.endsWith(".svelte")) {
        return null;
      }
      if (!compile) {
        const resolved = createRequire(path.join(packageDir, "package.json")).resolve(
          "svelte/compiler",
        );
        const imported: unknown = await import(pathToFileURL(resolved).href);
        // `require.resolve` finds the CommonJS build, whose exports land on `default`.
        const compiler =
          isRecord(imported) && isRecord(imported.default) ? imported.default : imported;
        if (!isRecord(compiler) || typeof compiler.compile !== "function") {
          throw new Error(`${resolved} has no \`compile\``);
        }
        const fn = compiler.compile;
        compile = (source, options) => fn(source, options);
      }
      const result = compile(code, { filename: id, generate: "client", css: "injected" });
      if (!isRecord(result) || !isRecord(result.js) || typeof result.js.code !== "string") {
        throw new Error(`Svelte did not compile ${id}`);
      }
      return { code: result.js.code, moduleType: "js" };
    },
  };
}

/**
 * Bundles an entry the way a consumer's bundler would: dependencies, and theirs, are included and
 * minified. A dependency the importing package declares as a peer is left out, since the app
 * provides it, and so are Node built-ins and specifiers nothing resolves (framework virtual
 * modules). Only the entry chunk and the chunks it imports statically count: dynamic imports load
 * lazily.
 */
export async function bundleEntry(
  packageDir: string,
  file: string,
): Promise<{ size: number; dependencies: string[] }> {
  const packageOf = createPackageLookup();
  const entry = path.join(packageDir, file);
  const measuredPkg = packageOf(entry);

  const { output } = await build({
    input: entry,
    write: false,
    platform: "browser",
    logLevel: "silent",
    // A consumer's bundler never reads the package's tsconfig, which may also extend a file only
    // its build generates.
    tsconfig: false,
    plugins: [svelteCompiler(packageDir)],
    external: (id, importer) => {
      if (id.startsWith("node:") || BUILTINS.has(id)) {
        return true;
      }
      const name = packageNameOf(id);
      const importerPkg = importer ? packageOf(importer) : measuredPkg;
      const peers = importerPkg?.peerDependencies;
      return name !== undefined && isRecord(peers) && name in peers;
    },
    output: { format: "esm", minify: true },
  });

  const chunks = new Map(
    output.flatMap(
      (item): Array<[string, OutputChunk]> =>
        item.type === "chunk" ? [[item.fileName, item]] : [],
    ),
  );
  const loaded = new Set<OutputChunk>();
  const visit = (chunk: OutputChunk | undefined): void => {
    if (!chunk || loaded.has(chunk)) {
      return;
    }
    loaded.add(chunk);
    for (const imported of chunk.imports) {
      visit(chunks.get(imported));
    }
  };
  visit([...chunks.values()].find((chunk) => chunk.isEntry));

  const dependencies = new Set<string>();
  for (const chunk of loaded) {
    for (const id of chunk.moduleIds) {
      const name = id.startsWith("\0") ? undefined : packageOf(id)?.name;
      if (typeof name === "string" && name !== measuredPkg?.name) {
        dependencies.add(name);
      }
    }
  }
  return {
    size: [...loaded].reduce((total, chunk) => total + gzipSize(chunk.code), 0),
    dependencies: [...dependencies].sort(),
  };
}

/** Rolldown's message lists every error under a count: keep the first error, without colors. */
export function firstError(message: string): string {
  // oxlint-disable-next-line no-control-regex
  const lines = message.replace(/\x1b\[[0-9;]*m/g, "").split("\n");
  return lines.find((line) => /^\[[A-Z_]+\]/.test(line)) ?? lines[0];
}

export async function measurePackage(
  root: string,
  project: ProjectConfig,
): Promise<PackageMeasurement> {
  const packageDir = path.join(root, project.dir);
  const result: PackageMeasurement = { dir: project.dir, entries: {}, files: {} };
  if (!fs.existsSync(path.join(packageDir, "dist"))) {
    return { ...result, error: "No `dist` directory. Build the package first." };
  }
  const pkg = readJson(path.join(packageDir, "package.json"));

  const files = fs
    .globSync("dist/**/*", { cwd: packageDir })
    .map(toPosix)
    .filter(
      (file) => isMeasured(file) && isPublished(file, pkg) && isFile(path.join(packageDir, file)),
    )
    .sort();
  for (const file of files) {
    if (isEsm(file, pkg)) {
      result.files[file] = { size: gzipSize(fs.readFileSync(path.join(packageDir, file))) };
    }
  }

  const seen = new Set<string>();
  for (const { subpath, file } of entryPoints(pkg)) {
    if (!isEsm(file, pkg) || seen.has(file)) {
      continue;
    }
    seen.add(file);
    if (!isFile(path.join(packageDir, file))) {
      return {
        ...result,
        error: `\`${subpath}\` points to ${file}, which the build did not emit.`,
      };
    }

    // `main` and `module` can point to different ES modules for the same subpath.
    const key = result.entries[subpath] ? `${subpath} (${file})` : subpath;
    try {
      result.entries[key] = await bundleEntry(packageDir, file);
    } catch (error) {
      const message = error instanceof Error ? firstError(error.message) : String(error);
      return { ...result, error: `Could not bundle \`${subpath}\` (${file}): ${message}` };
    }
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
 * `over`: grew past the threshold. `new` and `removed` are entries or files that only one of the
 * builds has.
 */
export type ChangeStatus = "ok" | "over" | "new" | "removed" | "no-base";

export type Change = {
  package: string;
  kind: Kind;
  name: string;
  /** Size on this branch, `undefined` when removed. */
  size: number | undefined;
  /** Size on the base, `undefined` when new or without a base. */
  base: number | undefined;
  status: ChangeStatus;
};

export type Comparison = {
  changes: Change[];
  /** Packages this branch could not measure. These always fail the check. */
  errors: Array<{ package: string; message: string }>;
};

const KIND_ITEMS: Array<[Kind, "entries" | "files"]> = [
  ["entry", "entries"],
  ["file", "files"],
];

export function isOver(size: number, base: number, percent = THRESHOLD_PERCENT): boolean {
  const growth = size - base;
  return growth > 0 && (base === 0 || (growth / base) * 100 > percent);
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
      const headItems: Record<string, Measured> = measured[items];
      const baseItems: Record<string, Measured> = hasBase ? (baseMeasured[items] ?? {}) : {};
      for (const [itemName, item] of Object.entries(headItems)) {
        const baseSize = baseItems[itemName]?.size;
        let status: ChangeStatus = "ok";
        if (!hasBase) {
          status = "no-base";
        } else if (baseSize === undefined) {
          status = "new";
        } else if (isOver(item.size, baseSize)) {
          status = "over";
        }
        comparison.changes.push({
          package: name,
          kind,
          name: itemName,
          size: item.size,
          base: baseSize,
          status,
        });
      }
      for (const [itemName, item] of Object.entries(baseItems)) {
        if (!(itemName in headItems)) {
          comparison.changes.push({
            package: name,
            kind,
            name: itemName,
            size: undefined,
            base: item.size,
            status: "removed",
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
    (!accepted && comparison.changes.some((change) => change.status === "over"))
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

export function describe(change: Change): string {
  return `${change.package} ${change.name} grew ${formatDelta(change.size, change.base)} to ${formatBytes(change.size ?? 0)} gzip, past the ${THRESHOLD_PERCENT}% threshold.`;
}

function changeCell(change: Change): string {
  if (change.status === "no-base") {
    return "–";
  }
  const delta = formatDelta(change.size, change.base);
  return change.status === "over" ? `${delta} ❌` : delta;
}

function toTable(changes: Change[], baseLabel: string, nameHeader: string): string[] {
  return [
    `| Package | ${nameHeader} | ${baseLabel} | This branch | Change |`,
    "| --- | --- | ---: | ---: | ---: |",
    ...changes.map(
      (change) =>
        `| \`${change.package}\` | \`${change.name}\` | ${change.base === undefined ? "–" : formatBytes(change.base)} | ${change.size === undefined ? "–" : formatBytes(change.size)} | ${changeCell(change)} |`,
    ),
  ];
}

function sizeCell(change: Change): string {
  return change.size === undefined ? "–" : formatBytes(change.size);
}

/** One row per export, grouped by package with its `.` export first, naming each package once. */
function toPackageTable(entries: Change[]): string[] {
  const byPackage = new Map<string, Change[]>();
  for (const change of entries) {
    let list = byPackage.get(change.package);
    if (!list) {
      list = [];
      byPackage.set(change.package, list);
    }
    list.push(change);
  }

  const rows = [...byPackage].flatMap(([name, list]) =>
    list
      .slice()
      .sort((a, b) => Number(b.name === ".") - Number(a.name === "."))
      .map(
        (change, index) =>
          `| ${index === 0 ? name : ""} | \`${change.name}\` | ${sizeCell(change)} | ${changeCell(change)} |`,
      ),
  );
  return ["| Package | Export | Size | Change |", "| --- | --- | ---: | ---: |", ...rows];
}

/**
 * Markdown report for the PR comment and the job summary: the entries that changed up front, files
 * past the threshold below them, and every package in a collapsed table.
 */
export function toMarkdown(comparison: Comparison, baseLabel = "Base", accepted = false): string {
  const { changes, errors } = comparison;
  const entries = changes.filter((change) => change.kind === "entry");
  const changed = entries.filter(isChanged);
  const files = changes.filter((change) => change.kind === "file" && change.status === "over");
  const over = changes.some((change) => change.status === "over");
  const hasBase = changes.some((change) => change.status !== "no-base");

  let intro: string;
  if (!hasBase) {
    intro = `No measurement of \`${baseLabel}\` to compare with, so only this branch's sizes are listed.`;
  } else if (changed.length === 0) {
    intro = `No package changed size compared with \`${baseLabel}\`.`;
  } else {
    intro = `${changed.length} of ${entries.length} entries changed size compared with \`${baseLabel}\`.`;
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
    ...(over && !accepted
      ? [
          "> [!CAUTION]",
          `> Some sizes grew past the threshold. If the growth is intended, add the \`${ACCEPT_LABEL}\` label to the PR and re-run the failed bundle size job.`,
          "",
        ]
      : []),
    ...(over && accepted
      ? [
          "> [!NOTE]",
          `> Growth past the threshold is accepted with the \`${ACCEPT_LABEL}\` label.`,
          "",
        ]
      : []),
    `<sub>Each export minified and gzipped with its dependencies, without peers. Fails past ${THRESHOLD_PERCENT}% growth.</sub>`,
    "",
    "<details>",
    "<summary>All packages</summary>",
    "",
    ...toPackageTable(entries),
    "",
    "</details>",
    "",
  ].join("\n");
}
