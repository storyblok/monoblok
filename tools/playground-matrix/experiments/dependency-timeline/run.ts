#!/usr/bin/env node
/**
 * What happens to a shared dependency when several SDKs are installed years apart.
 *
 * The Docker matrix installs an app once, so it cannot show how a lockfile
 * behaves as it grows. This does. Three stand-in SDKs are built, each frozen at
 * the version of `@storyblok/preview-bridge` that was current when it shipped,
 * and each declaring the caret range a real manifest would. Every SDK is built
 * twice: once with the dependency inlined, which is what Vite library mode did
 * before the migration, and once with it left as a bare import, which is what
 * `vp pack` does.
 *
 * The app is then installed four ways, including one that grows the lockfile a
 * release at a time, and the build output is searched for the copies.
 *
 * Run with: node --experimental-strip-types run.ts
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { gzipSync } from "node:zlib";

type Sdk = { name: string; exact: string; range: string };
type Flavor = "bundled" | "external";
type Mode = "fresh" | "incremental" | "timeline";

type Result = {
  flavor: Flavor;
  mode: Mode;
  installed: string[];
  copies: Record<string, number>;
  totalCopies: number;
  chunks: number;
  rawBytes: number;
  gzipBytes: number;
};

const ROOT = import.meta.dirname;
const WORK = path.join(ROOT, ".work");
const VITE = "^6.4.3";

/** Each SDK ships on the day its bridge version was the newest one available. */
const SDKS: Sdk[] = [
  { name: "sdk-a", exact: "2.1.2", range: "^2.1.2" },
  { name: "sdk-b", exact: "2.1.6", range: "^2.1.6" },
  { name: "sdk-c", exact: "2.2.1", range: "^2.2.0" },
];

/**
 * String literals that survive minification, chosen so the three versions can
 * be told apart in a bundle where they have no version left.
 *
 * `storyblok-bridge-stylesheet` is the id of the style element the bridge
 * injects, and appears once per copy. `fallbackLang` arrived in 2.1.6.
 * `offsetWidth` disappeared in 2.2.0, which moved overlay sizing to
 * `getBoundingClientRect()`.
 */
const MARKERS = {
  total: "storyblok-bridge-stylesheet",
  since216: "fallbackLang",
  before220: "offsetWidth",
};

const SDK_SOURCE = `export async function load(config) {
  const { default: StoryblokBridge } = await import("@storyblok/preview-bridge");
  return new StoryblokBridge(config);
}
`;

function npm(args: string[], cwd: string): void {
  execFileSync("npm", [...args, "--no-audit", "--no-fund"], { cwd, stdio: "ignore" });
}

function manifest(sdk: Sdk, dependency: string): string {
  return JSON.stringify(
    {
      name: sdk.name,
      version: "1.0.0",
      type: "module",
      main: "./dist/index.mjs",
      exports: { ".": "./dist/index.mjs" },
      files: ["dist"],
      dependencies: { "@storyblok/preview-bridge": dependency },
    },
    null,
    2,
  );
}

function buildSdks(): void {
  for (const flavor of ["bundled", "external"] as Flavor[]) {
    mkdirSync(path.join(WORK, "tarballs", flavor), { recursive: true });

    for (const sdk of SDKS) {
      const dir = path.join(WORK, "sdks", flavor, sdk.name);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(path.join(dir, "src"), { recursive: true });
      writeFileSync(path.join(dir, "src", "index.js"), SDK_SOURCE);

      // Vite library mode externalizes declared dependencies by default, but
      // naming any `external` at all replaces that default. That is how the
      // pre-migration configs inlined a dependency they also declared: the list
      // mentioned a few packages and quietly bundled everything else.
      const external =
        flavor === "external" ? '["@storyblok/preview-bridge"]' : '["__nothing_matches_this__"]';

      writeFileSync(
        path.join(dir, "vite.config.js"),
        `import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: { entry: "src/index.js", formats: ["es"], fileName: () => "index.mjs" },
    rollupOptions: { external: ${external} },
  },
});
`,
      );

      // Build against the exact version of the day, then ship the caret range,
      // the way a lockfile and a manifest disagree in real life.
      writeFileSync(
        path.join(dir, "package.json"),
        manifest(sdk, sdk.exact).replace(
          '"dependencies"',
          `"devDependencies": { "vite": "${VITE}" },\n  "dependencies"`,
        ),
      );
      npm(["install", "--silent"], dir);
      execFileSync("npx", ["vite", "build"], { cwd: dir, stdio: "ignore" });

      writeFileSync(path.join(dir, "package.json"), manifest(sdk, sdk.range));
      npm(["pack", "--pack-destination", path.join(WORK, "tarballs", flavor)], dir);

      process.stdout.write(
        `built ${flavor}/${sdk.name} against ${sdk.exact}, declares ${sdk.range}\n`,
      );
    }
  }
}

function tarball(flavor: Flavor, sdk: Sdk): string {
  return path.join(WORK, "tarballs", flavor, `${sdk.name}-1.0.0.tgz`);
}

function installedVersions(dir: string): string[] {
  const found: string[] = [];

  const walk = (current: string, depth: number): void => {
    if (depth > 8) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = path.join(current, entry.name);
      if (entry.name === "preview-bridge" && current.endsWith(`${path.sep}@storyblok`)) {
        found.push(JSON.parse(readFileSync(path.join(child, "package.json"), "utf8")).version);
        continue;
      }
      walk(child, depth + 1);
    }
  };

  walk(path.join(dir, "node_modules"), 0);
  return found.sort();
}

function measure(dir: string): Omit<Result, "flavor" | "mode" | "installed"> {
  const assets = path.join(dir, "dist", "assets");
  const files = readdirSync(assets).filter((file) => file.endsWith(".js"));
  const sources = files.map((file) => readFileSync(path.join(assets, file), "utf8"));

  const count = (marker: string): number =>
    sources.reduce((total, source) => total + source.split(marker).length - 1, 0);

  const total = count(MARKERS.total);
  const v221 = total - count(MARKERS.before220);
  const v212 = total - count(MARKERS.since216);

  return {
    copies: { "2.1.2": v212, "2.1.6": total - v212 - v221, "2.2.1": v221 },
    totalCopies: total,
    chunks: files.length,
    rawBytes: sources.reduce((total, source) => total + Buffer.byteLength(source), 0),
    // Summed per file, because that is how a server serves them.
    gzipBytes: files.reduce(
      (total, file) => total + gzipSync(readFileSync(path.join(assets, file)), { level: 9 }).length,
      0,
    ),
  };
}

function runCase(flavor: Flavor, mode: Mode): Result {
  const dir = path.join(WORK, "apps", `${flavor}-${mode}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  cpSync(path.join(ROOT, "app"), dir, { recursive: true });

  const base = {
    name: "timeline-app",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { build: "vite build" },
    devDependencies: { vite: VITE },
  };

  if (mode === "fresh") {
    writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        {
          ...base,
          dependencies: Object.fromEntries(
            SDKS.map((sdk) => [sdk.name, `file:${tarball(flavor, sdk)}`]),
          ),
        },
        null,
        2,
      ),
    );
    npm(["install"], dir);
  } else {
    writeFileSync(path.join(dir, "package.json"), JSON.stringify(base, null, 2));
    npm(["install"], dir);

    for (const sdk of SDKS) {
      if (mode === "timeline") {
        // Pin the bridge to the version that was current when this SDK shipped,
        // then drop the direct dependency. The resolution stays in the lockfile,
        // which is what makes a later install inherit an older choice.
        npm(["install", tarball(flavor, sdk), `@storyblok/preview-bridge@${sdk.exact}`], dir);
        npm(["uninstall", "@storyblok/preview-bridge"], dir);
      } else {
        npm(["install", tarball(flavor, sdk)], dir);
      }
    }
  }

  npm(["run", "build"], dir);

  return { flavor, mode, installed: installedVersions(dir), ...measure(dir) };
}

function table(results: Result[]): string {
  const rows = results.map((result) => {
    const bundled = Object.entries(result.copies)
      .filter(([, count]) => count > 0)
      .map(([version, count]) => (count === 1 ? version : `${version} x${count}`))
      .join(", ");

    return (
      `| ${result.flavor} | ${result.mode} | ${result.installed.join(", ") || "none"} ` +
      `| ${result.totalCopies} | ${bundled || "none"} | ${result.chunks} ` +
      `| ${(result.rawBytes / 1024).toFixed(1)} kB | ${(result.gzipBytes / 1024).toFixed(1)} kB |`
    );
  });

  return [
    "| Packaging | Install | Installed versions | Copies in bundle | Which | Chunks | Raw | Gzip |",
    "| --- | --- | --- | ---: | --- | ---: | ---: | ---: |",
    ...rows,
  ].join("\n");
}

if (!process.argv.includes("--skip-build")) buildSdks();

const results: Result[] = [];
for (const flavor of ["bundled", "external"] as Flavor[]) {
  for (const mode of ["fresh", "incremental", "timeline"] as Mode[]) {
    results.push(runCase(flavor, mode));
    process.stdout.write(`ran ${flavor}/${mode}\n`);
  }
}

process.stdout.write(`\n${table(results)}\n`);
