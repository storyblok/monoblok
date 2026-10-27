import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compare,
  entryPoints,
  firstError,
  hasFailed,
  isPublished,
  loadProjects,
  measure,
  packageNameOf,
  toMarkdown,
  type Measurement,
  type PackageMeasurement,
} from "./size";

// Varied enough that minifying and gzipping keep it measurable.
const code = (name: string) =>
  `export const ${name} = [${Array.from({ length: 200 }, (_, index) => `"${name}-${index * 7919}"`).join(",")}];\n`;

let root: string;

function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
}

function writePackage(
  dir: string,
  pkg: Record<string, unknown>,
  files: Record<string, string> = {},
): void {
  writeFiles(path.join(root, "packages", dir), { "package.json": JSON.stringify(pkg), ...files });
}

/** A dependency installed in `node_modules/<name>` of a package, or of another dependency. */
function dependency(
  name: string,
  files: Record<string, string>,
  pkg: Record<string, unknown> = {},
) {
  return Object.fromEntries([
    [
      `node_modules/${name}/package.json`,
      JSON.stringify({ name, type: "module", exports: "./index.js", ...pkg }),
    ],
    ...Object.entries(files).map(([file, content]) => [`node_modules/${name}/${file}`, content]),
  ]);
}

function measured(overrides: Partial<PackageMeasurement> = {}): PackageMeasurement {
  return {
    dir: "packages/pkg",
    entries: { ".": { size: 1000, dependencies: [] } },
    files: { "dist/index.mjs": { size: 1000 } },
    ...overrides,
  };
}

const withEntry = (size: number) => measured({ entries: { ".": { size, dependencies: [] } } });

const single = (pkg: PackageMeasurement): Measurement => ({ packages: { "@storyblok/pkg": pkg } });

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "monoblok-size-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("loadProjects", () => {
  it("should measure every package except the ignored ones", () => {
    writePackage("vue", { name: "@storyblok/vue" });
    writePackage("cli", { name: "storyblok" });
    writePackage("lint-config", { name: "@storyblok/lint-config" });

    expect(loadProjects(root).map((project) => project.name)).toEqual(["@storyblok/vue"]);
  });

  it("should fail when the root has no packages to measure", () => {
    expect(() => loadProjects(root)).toThrow(/No packages found/);
  });

  it("should reject a package name that is not measured", () => {
    writePackage("vue", { name: "@storyblok/vue" });
    writePackage("cli", { name: "storyblok" });

    expect(() => loadProjects(root, ["storyblok"])).toThrow(/Not a measured package: storyblok/);
  });
});

describe("entryPoints", () => {
  it("should collect the ES module of every subpath", () => {
    const points = entryPoints({
      exports: {
        ".": {
          import: { types: "./dist/index.d.mts", default: "./dist/index.mjs" },
          require: { types: "./dist/index.d.cts", default: "./dist/index.cjs" },
        },
        "./style.css": "./dist/style.css",
        "./package.json": "./package.json",
        "./icons/*": "./dist/icons/*.mjs",
      },
      unpkg: "./dist/index.umd.js",
    });

    expect(points).toEqual([{ subpath: ".", file: "dist/index.mjs" }]);
  });

  it("should skip ignored exports and add extra entries", () => {
    const points = entryPoints({
      name: "@storyblok/nuxt",
      exports: { ".": "./dist/module.mjs", "./server": "./dist/runtime/server/index.js" },
    });

    expect(points).toEqual([
      { subpath: "runtime/plugin", file: "dist/runtime/plugin.js" },
      { subpath: "./server", file: "dist/runtime/server/index.js" },
    ]);
  });
});

describe("isPublished", () => {
  it("should honor directories, globs, and negations in `files`", () => {
    const pkg = { files: ["dist", "!dist/**/*.spec.*"] };

    expect(isPublished("dist/fesm2022/index.mjs", { files: ["dist/fesm2022"] })).toBe(true);
    expect(isPublished("dist/integration-tests/main.js", { files: ["dist/fesm2022"] })).toBe(false);
    expect(isPublished("dist/index.spec.js", pkg)).toBe(false);
    expect(isPublished("dist/anything.js", {})).toBe(true);
  });
});

describe("packageNameOf", () => {
  it("should name the package of a bare specifier only", () => {
    expect(packageNameOf("@storyblok/js/sub")).toBe("@storyblok/js");
    expect(packageNameOf("vue")).toBe("vue");
    expect(packageNameOf("./local.mjs")).toBeUndefined();
    expect(packageNameOf("#app")).toBeUndefined();
    expect(packageNameOf("node:fs")).toBeUndefined();
  });
});

describe("measure", () => {
  it("should bundle an entry with its dependencies and theirs", async () => {
    writePackage(
      "pkg",
      { name: "@storyblok/pkg", type: "module", exports: { ".": "./dist/index.mjs" } },
      {
        "dist/index.mjs": `import { dep, inner } from "dep";\nimport { local } from "./local.mjs";\nexport const all = [dep, inner, local];\n`,
        "dist/local.mjs": code("local"),
        ...dependency("dep", {
          "index.js": `import { inner } from "inner";\n${code("dep")}export { inner };\n`,
        }),
        ...dependency("dep/node_modules/inner", { "index.js": code("inner") }, { name: "inner" }),
      },
    );

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(pkg.entries["."].dependencies).toEqual(["dep", "inner"]);
    expect(Object.keys(pkg.files)).toEqual(["dist/index.mjs", "dist/local.mjs"]);
  });

  it("should leave out peer dependencies, including a dependency's own peers", async () => {
    writePackage(
      "pkg",
      {
        name: "@storyblok/pkg",
        type: "module",
        exports: { ".": "./dist/index.mjs" },
        peerDependencies: { framework: "*" },
      },
      {
        "dist/index.mjs": `import { framework } from "framework";\nimport { plugin } from "plugin";\nexport const all = [framework, plugin];\n`,
        ...dependency("framework", { "index.js": code("framework") }),
        ...dependency(
          "plugin",
          {
            "index.js": `import { runtime } from "runtime";\n${code("plugin")}export { runtime };\n`,
          },
          { peerDependencies: { runtime: "*" } },
        ),
        ...dependency(
          "plugin/node_modules/runtime",
          { "index.js": code("runtime") },
          { name: "runtime" },
        ),
      },
    );

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(pkg.entries["."].dependencies).toEqual(["plugin"]);
  });

  it("should leave out chunks that load lazily", async () => {
    writePackage(
      "pkg",
      { name: "@storyblok/pkg", type: "module", exports: { ".": "./dist/index.mjs" } },
      {
        "dist/index.mjs": `export const load = () => import("lazy");\n`,
        ...dependency("lazy", { "index.js": code("lazy") }),
      },
    );

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(pkg.entries["."].dependencies).toEqual([]);
    expect(pkg.entries["."].size).toBeLessThan(200);
  });

  it("should measure only ES modules, skipping CommonJS, UMD, and CSS", async () => {
    writePackage(
      "pkg",
      {
        name: "@storyblok/pkg",
        exports: {
          ".": { import: "./dist/index.mjs", require: "./dist/index.cjs" },
          "./style.css": "./dist/style.css",
        },
        unpkg: "./dist/index.umd.js",
      },
      {
        "dist/index.mjs": code("esm"),
        "dist/index.cjs": `module.exports = require("./other.cjs");\n`,
        "dist/other.cjs": code("cjs"),
        "dist/index.umd.js": `(function(){ var umd = ${JSON.stringify(code("umd"))}; window.umd = umd; })();\n`,
        "dist/style.css": ".a { color: red; }",
      },
    );

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(Object.keys(pkg.entries)).toEqual(["."]);
    expect(Object.keys(pkg.files)).toEqual(["dist/index.mjs"]);
  });

  it("should ignore a tsconfig that extends a file only the build generates", async () => {
    writePackage(
      "pkg",
      { name: "@storyblok/pkg", type: "module", exports: { ".": "./dist/index.mjs" } },
      {
        "tsconfig.json": JSON.stringify({ extends: "./.generated/tsconfig.json" }),
        "dist/index.mjs": `export { local } from "./local";\n`,
        "dist/local.js": code("local"),
      },
    );

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(pkg.error).toBeUndefined();
    expect(pkg.entries["."].size).toBeGreaterThan(200);
  });

  it("should report a package that is not built", async () => {
    writePackage("pkg", { name: "@storyblok/pkg" });

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(pkg.error).toMatch(/Build the package first/);
  });

  it("should report an export that points to a file the build did not emit", async () => {
    writePackage(
      "pkg",
      { name: "@storyblok/pkg", type: "module", exports: { "./ssr": "./dist/ssr.mjs" } },
      { "dist/index.mjs": code("index") },
    );

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(pkg.error).toBe("`./ssr` points to dist/ssr.mjs, which the build did not emit.");
  });
});

describe("firstError", () => {
  it("should keep the first error of a build failure, without colors", () => {
    const message =
      "Build failed with 2 errors:\n\n\x1b[31m[RESOLVE_ERROR]\x1b[0m Could not resolve 'a'\n\n[RESOLVE_ERROR] Could not resolve 'b'";

    expect(firstError(message)).toBe("[RESOLVE_ERROR] Could not resolve 'a'");
    expect(firstError("Something else")).toBe("Something else");
  });
});

describe("compare", () => {
  it("should fail growth past 5%, however few bytes it is", () => {
    const comparison = compare(single(withEntry(106)), single(withEntry(100)));

    expect(comparison.changes[0]).toMatchObject({ name: ".", status: "over" });
    expect(hasFailed(comparison)).toBe(true);
  });

  it("should pass growth within 5%", () => {
    const comparison = compare(single(withEntry(1050)), single(withEntry(1000)));

    expect(comparison.changes[0]).toMatchObject({ status: "ok" });
    expect(hasFailed(comparison)).toBe(false);
  });

  it("should mark entries only one build has as new or removed", () => {
    const head = single(measured({ entries: { "./ssr": { size: 10, dependencies: [] } } }));
    const { changes } = compare(head, single(measured()));

    expect(changes.filter((change) => change.kind === "entry")).toMatchObject([
      { name: "./ssr", status: "new" },
      { name: ".", status: "removed" },
    ]);
  });

  it("should compare nothing for a package without a base measurement", () => {
    const base = single(measured({ error: "not built" }));
    const comparison = compare(single(withEntry(5000)), base);

    expect(comparison.changes.every((change) => change.status === "no-base")).toBe(true);
    expect(hasFailed(comparison)).toBe(false);
  });

  it("should fail on a package this branch could not measure, even when growth is accepted", () => {
    const comparison = compare(single(measured({ error: "not built" })), undefined);

    expect(comparison.errors).toEqual([{ package: "@storyblok/pkg", message: "not built" }]);
    expect(hasFailed(comparison, true)).toBe(true);
  });

  it("should pass accepted growth", () => {
    const comparison = compare(single(withEntry(2000)), single(withEntry(1000)));

    expect(hasFailed(comparison, true)).toBe(false);
  });
});

describe("toMarkdown", () => {
  it("should say when no package changed size", () => {
    const markdown = toMarkdown(compare(single(measured()), single(measured())), "main");

    expect(markdown).toContain("No package changed size compared with `main`.");
  });

  it("should list growth past the threshold and how to accept it", () => {
    const comparison = compare(single(withEntry(2000)), single(withEntry(1000)));
    const markdown = toMarkdown(comparison, "main");

    expect(markdown).toContain("| Package | Entry | main | This branch | Change |\n");
    expect(markdown).toContain(
      "| `@storyblok/pkg` | `.` | 1000 B | 1.95 kB | +1000 B (+100.0%) ❌ |",
    );
    expect(markdown).toContain("add the `bundle-size-accepted` label");
    expect(toMarkdown(comparison, "main", true)).toContain(
      "accepted with the `bundle-size-accepted` label",
    );
  });

  it("should group exports by package, naming each package once", () => {
    const pkg = (size: number) =>
      measured({
        entries: {
          "./ssr": { size, dependencies: [] },
          ".": { size: 1000, dependencies: [] },
        },
      });
    const markdown = toMarkdown(compare(single(pkg(1300)), single(pkg(1000))), "main");

    expect(markdown).toContain(
      [
        "| Package | Export | Size | Change |",
        "| --- | --- | ---: | ---: |",
        "| @storyblok/pkg | `.` | 1000 B | 0 B |",
        "|  | `./ssr` | 1.27 kB | +300 B (+30.0%) ❌ |",
      ].join("\n"),
    );
  });

  it("should list only this branch's sizes without a base", () => {
    const markdown = toMarkdown(compare(single(measured()), undefined), "main");

    expect(markdown).toContain("No measurement of `main` to compare with");
  });
});
