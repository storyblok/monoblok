import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compare,
  entryPoints,
  hasFailed,
  isPublished,
  loadProjects,
  measure,
  toMarkdown,
  type Measurement,
  type PackageMeasurement,
} from "./size";

const CODE = "export const greeting = 'hello world';\n".repeat(20);
const gzipSize = (content: string) => zlib.gzipSync(content, { level: 9 }).length;

let root: string;

function writePackage(
  dir: string,
  pkg: Record<string, unknown>,
  files: Record<string, string> = {},
): void {
  const packageDir = path.join(root, "packages", dir);
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify(pkg));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(packageDir, file)), { recursive: true });
    fs.writeFileSync(path.join(packageDir, file), content);
  }
}

function measured(overrides: Partial<PackageMeasurement> = {}): PackageMeasurement {
  return {
    dir: "packages/pkg",
    entries: { ". (esm)": { format: "esm", size: 1000, files: ["dist/index.mjs"] } },
    totals: { esm: { format: "esm", size: 1000 } },
    files: { "dist/index.mjs": { format: "esm", size: 1000 } },
    ...overrides,
  };
}

function withEntry(format: "esm" | "cjs", size: number): PackageMeasurement {
  return measured({ entries: { [`. (${format})`]: { format, size, files: [] } } });
}

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
  it("should collect every runtime target of every subpath", () => {
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

    expect(points).toEqual([
      { subpath: ".", file: "dist/index.mjs" },
      { subpath: ".", file: "dist/index.cjs" },
      { subpath: "./style.css", file: "dist/style.css" },
      { subpath: ".", file: "dist/index.umd.js" },
    ]);
  });

  it("should treat a conditions-only `exports` as the root subpath", () => {
    expect(entryPoints({ exports: { import: "./dist/index.mjs" } })).toEqual([
      { subpath: ".", file: "dist/index.mjs" },
    ]);
  });
});

describe("isPublished", () => {
  it("should honor directories, globs, and negations in `files`", () => {
    const pkg = { files: ["dist/fesm2022", "dist", "!dist/**/*.spec.*"] };

    expect(isPublished("dist/fesm2022/index.mjs", { files: ["dist/fesm2022"] })).toBe(true);
    expect(isPublished("dist/integration-tests/main.js", { files: ["dist/fesm2022"] })).toBe(false);
    expect(isPublished("dist/index.spec.js", pkg)).toBe(false);
    expect(isPublished("dist/anything.js", {})).toBe(true);
  });
});

describe("measure", () => {
  it("should size an entry with the files it statically imports from the package", async () => {
    writePackage(
      "pkg",
      { name: "@storyblok/pkg", type: "module", exports: { ".": "./dist/index.mjs" } },
      {
        "dist/index.mjs": `import { a } from "./a.mjs";\nimport type { T } from "./types.mjs";\nimport dep from "dependency";\nconst lazy = () => import("./lazy.mjs");\n${CODE}`,
        "dist/a.mjs": `export * from "./b.mjs";\n${CODE}`,
        "dist/b.mjs": CODE,
        "dist/types.mjs": CODE,
        "dist/lazy.mjs": CODE,
        "dist/index.d.mts": CODE,
      },
    );

    const { packages } = await measure(root);
    const pkg = packages["@storyblok/pkg"];

    expect(pkg.entries[". (esm)"].files).toEqual(["dist/a.mjs", "dist/b.mjs", "dist/index.mjs"]);
    expect(Object.keys(pkg.files)).toEqual([
      "dist/a.mjs",
      "dist/b.mjs",
      "dist/index.mjs",
      "dist/lazy.mjs",
      "dist/types.mjs",
    ]);
    expect(pkg.totals.esm.size).toBe(
      Object.values(pkg.files).reduce((total, file) => total + file.size, 0),
    );
  });

  it("should follow `require` in CommonJS and split totals by format", async () => {
    writePackage(
      "pkg",
      {
        name: "@storyblok/pkg",
        exports: { ".": { import: "./dist/index.mjs", require: "./dist/index.cjs" } },
        unpkg: "./dist/index.umd.js",
      },
      {
        "dist/index.mjs": CODE,
        "dist/index.cjs": `const a = require("./a.cjs");\n${CODE}`,
        "dist/a.cjs": CODE,
        "dist/index.umd.js": CODE,
        "dist/style.css": ".a { color: red; }",
      },
    );

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(Object.keys(pkg.entries)).toEqual([". (esm)", ". (cjs)", ". (umd)"]);
    expect(pkg.entries[". (cjs)"].files).toEqual(["dist/a.cjs", "dist/index.cjs"]);
    expect(pkg.entries[". (esm)"].size).toBe(gzipSize(CODE));
    expect(Object.keys(pkg.totals).sort()).toEqual(["cjs", "css", "esm", "umd"]);
  });

  it("should report a package that is not built", async () => {
    writePackage("pkg", { name: "@storyblok/pkg" });

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(pkg.error).toMatch(/Build the package first/);
  });

  it("should report an export that points to a file the build did not emit", async () => {
    writePackage(
      "pkg",
      { name: "@storyblok/pkg", exports: { "./ssr": "./dist/ssr.mjs" } },
      { "dist/index.mjs": CODE },
    );

    const pkg = (await measure(root)).packages["@storyblok/pkg"];

    expect(pkg.error).toBe("`./ssr` points to dist/ssr.mjs, which the build did not emit.");
  });
});

describe("compare", () => {
  it("should fail growth past both the percent and the bytes threshold", () => {
    const { changes } = compare(single(withEntry("esm", 1300)), single(withEntry("esm", 1000)));

    expect(changes[0]).toMatchObject({ name: ". (esm)", status: "over", blocking: true });
  });

  it("should pass growth past the percent but within the bytes threshold", () => {
    const { changes } = compare(single(withEntry("esm", 1150)), single(withEntry("esm", 1000)));

    expect(changes[0]).toMatchObject({ status: "ok", blocking: false });
  });

  it("should report CommonJS growth without failing", () => {
    const comparison = compare(single(withEntry("cjs", 2000)), single(withEntry("cjs", 1000)));

    expect(comparison.changes[0]).toMatchObject({ status: "over", blocking: false });
    expect(hasFailed(comparison)).toBe(false);
  });

  it("should mark entries only one build has as new or removed", () => {
    const head = single(
      measured({ entries: { "./ssr (esm)": { format: "esm", size: 10, files: [] } } }),
    );
    const { changes } = compare(head, single(measured()));

    expect(changes.filter((change) => change.kind === "entry")).toMatchObject([
      { name: "./ssr (esm)", status: "new", blocking: false },
      { name: ". (esm)", status: "removed", blocking: false },
    ]);
  });

  it("should compare nothing for a package without a base measurement", () => {
    const base = single(measured({ error: "not built" }));
    const comparison = compare(single(withEntry("esm", 5000)), base);

    expect(comparison.changes.every((change) => change.status === "no-base")).toBe(true);
    expect(hasFailed(comparison)).toBe(false);
  });

  it("should fail on a package this branch could not measure, even when growth is accepted", () => {
    const comparison = compare(single(measured({ error: "not built" })), undefined);

    expect(comparison.errors).toEqual([{ package: "@storyblok/pkg", message: "not built" }]);
    expect(hasFailed(comparison, true)).toBe(true);
  });

  it("should pass accepted growth", () => {
    const comparison = compare(single(withEntry("esm", 2000)), single(withEntry("esm", 1000)));

    expect(hasFailed(comparison)).toBe(true);
    expect(hasFailed(comparison, true)).toBe(false);
  });
});

describe("toMarkdown", () => {
  it("should say when no package changed size", () => {
    const markdown = toMarkdown(compare(single(measured()), single(measured())), "main");

    expect(markdown).toContain("No package changed size compared with `main`.");
  });

  it("should list growth past the threshold and how to accept it", () => {
    const comparison = compare(single(withEntry("esm", 2000)), single(withEntry("esm", 1000)));
    const markdown = toMarkdown(comparison, "main");

    expect(markdown).toContain(
      "| `@storyblok/pkg` | `. (esm)` | 1000 B | 1.95 kB | +1000 B (+100.0%) | ❌ over |",
    );
    expect(markdown).toContain("add the `bundle-size-accepted` label");
    expect(toMarkdown(comparison, "main", true)).toContain(
      "accepted with the `bundle-size-accepted` label",
    );
  });

  it("should list only this branch's sizes without a base", () => {
    const markdown = toMarkdown(compare(single(measured()), undefined), "main");

    expect(markdown).toContain("No measurement of `main` to compare with");
  });
});
