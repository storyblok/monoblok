import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkProject,
  evaluate,
  formatChange,
  formatDelta,
  loadBaseEntries,
  loadProjects,
  parseConfig,
  resolveThresholds,
  toMarkdown,
  updateBaselines,
} from "./size";

const ENTRY = "export const greeting = 'hello world';\n".repeat(20);
const gzipSize = (content: string) => zlib.gzipSync(content, { level: 9 }).length;

let root: string;

function writePackage(
  dir: string,
  name: string,
  config: unknown,
  files: Record<string, string> = {},
): void {
  const packageDir = path.join(root, "packages", dir);
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name }));
  fs.writeFileSync(path.join(packageDir, "bundle-size.json"), JSON.stringify(config));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(packageDir, file)), { recursive: true });
    fs.writeFileSync(path.join(packageDir, file), content);
  }
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "monoblok-size-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("evaluate", () => {
  const thresholds = { warn: 5, error: 10 };

  it("should pass growth within the warning threshold", () => {
    expect(evaluate(1050, 1000, thresholds)).toEqual({ change: 5, status: "ok" });
  });

  it("should warn on growth past the warning threshold", () => {
    expect(evaluate(1051, 1000, thresholds).status).toBe("warn");
  });

  it("should fail on growth past the error threshold", () => {
    expect(evaluate(1101, 1000, thresholds).status).toBe("error");
  });

  it("should flag a size well below the baseline as shrunk", () => {
    expect(evaluate(900, 1000, thresholds).status).toBe("shrunk");
  });

  it("should fail when an empty baseline grows", () => {
    expect(evaluate(10, 0, thresholds)).toEqual({ change: Infinity, status: "error" });
  });
});

describe("parseConfig", () => {
  it("should reject a config without entries", () => {
    expect(() => parseConfig({ entries: {} }, "bundle-size.json")).toThrow(/"entries"/);
  });

  it("should reject a non-numeric baseline", () => {
    expect(() => parseConfig({ entries: { "dist/*.mjs": "1kB" } }, "bundle-size.json")).toThrow(
      /baseline for "dist\/\*\.mjs"/,
    );
  });

  it("should reject a negative threshold", () => {
    expect(() =>
      parseConfig({ warn: -1, entries: { "dist/*.mjs": 1 } }, "bundle-size.json"),
    ).toThrow(/"warn"/);
  });
});

describe("resolveThresholds", () => {
  it("should fall back to the default thresholds", () => {
    expect(resolveThresholds({ entries: {} })).toEqual({ warn: 5, error: 10 });
  });

  it("should let a package override its thresholds", () => {
    expect(resolveThresholds({ warn: 20, error: 50, entries: {} })).toEqual({
      warn: 20,
      error: 50,
    });
  });

  it("should reject a warning threshold above the error threshold", () => {
    expect(() => resolveThresholds({ warn: 20, entries: {} })).toThrow(/must not exceed/);
  });
});

describe("loadProjects", () => {
  it("should load every package with a bundle-size.json", () => {
    writePackage("b", "@storyblok/b", { entries: { "dist/*.mjs": 1 } });
    writePackage("a", "@storyblok/a", { entries: { "dist/*.mjs": 1 } });
    fs.mkdirSync(path.join(root, "packages", "no-config"));

    expect(loadProjects(root).map((project) => project.name)).toEqual([
      "@storyblok/a",
      "@storyblok/b",
    ]);
  });

  it("should filter packages by name", () => {
    writePackage("a", "@storyblok/a", { entries: { "dist/*.mjs": 1 } });
    writePackage("b", "@storyblok/b", { entries: { "dist/*.mjs": 1 } });

    expect(loadProjects(root, ["@storyblok/b"]).map((project) => project.name)).toEqual([
      "@storyblok/b",
    ]);
  });

  it("should fail for a package without a bundle-size.json", () => {
    writePackage("a", "@storyblok/a", { entries: { "dist/*.mjs": 1 } });

    expect(() => loadProjects(root, ["@storyblok/missing"])).toThrow(/@storyblok\/missing/);
  });
});

describe("checkProject", () => {
  it("should sum the gzipped size of matching files, skipping types and source maps", () => {
    writePackage(
      "a",
      "@storyblok/a",
      { entries: { "dist/**/*.mjs": 2 * gzipSize(ENTRY) } },
      {
        "dist/index.mjs": ENTRY,
        "dist/nested/chunk.mjs": ENTRY,
        "dist/index.d.mts": ENTRY,
        "dist/index.mjs.map": ENTRY,
        "dist/index.cjs": ENTRY,
      },
    );
    const [project] = loadProjects(root);

    const [entry] = checkProject(root, project).entries;

    expect(entry.files).toEqual(["dist/index.mjs", "dist/nested/chunk.mjs"]);
    expect(entry.size).toBe(2 * gzipSize(ENTRY));
    expect(entry.status).toBe("ok");
  });

  it("should fail past the package's own error threshold", () => {
    writePackage(
      "a",
      "@storyblok/a",
      { warn: 1, error: 2, entries: { "dist/*.mjs": Math.floor(gzipSize(ENTRY) * 0.95) } },
      { "dist/index.mjs": ENTRY },
    );
    const [project] = loadProjects(root);

    expect(checkProject(root, project).entries[0].status).toBe("error");
  });

  it("should gate on the package's own baseline while reporting the base branch's", () => {
    writePackage(
      "a",
      "@storyblok/a",
      { entries: { "dist/*.mjs": gzipSize(ENTRY) } },
      { "dist/index.mjs": ENTRY },
    );
    const [project] = loadProjects(root);

    const [entry] = checkProject(root, project, { "dist/*.mjs": 10 }).entries;

    expect(entry).toMatchObject({ base: 10, baseline: gzipSize(ENTRY), status: "ok" });
  });

  it("should report a pattern that matches no files as missing", () => {
    writePackage("a", "@storyblok/a", { entries: { "dist/*.mjs": 100 } });
    const [project] = loadProjects(root);

    expect(checkProject(root, project).entries[0].status).toBe("missing");
  });
});

describe("updateBaselines", () => {
  it("should set every baseline to the current size and keep the thresholds", () => {
    writePackage(
      "a",
      "@storyblok/a",
      { warn: 3, error: 6, entries: { "dist/*.mjs": 1 } },
      { "dist/index.mjs": ENTRY },
    );
    const [project] = loadProjects(root);

    expect(updateBaselines(root, project)).toEqual({
      warn: 3,
      error: 6,
      entries: { "dist/*.mjs": gzipSize(ENTRY) },
    });
  });

  it("should refuse to update a pattern that matches no files", () => {
    writePackage("a", "@storyblok/a", { entries: { "dist/*.mjs": 1 } });
    const [project] = loadProjects(root);

    expect(() => updateBaselines(root, project)).toThrow(/Build the package/);
  });
});

describe("loadBaseEntries", () => {
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });

  beforeEach(() => {
    git("init", "-q");
    git("config", "user.email", "ci@example.com");
    git("config", "user.name", "CI");
  });

  it("should read the baselines a package has on the ref", () => {
    writePackage("a", "@storyblok/a", { entries: { "dist/*.mjs": 100 } });
    git("add", ".");
    git("commit", "-qm", "base");
    writePackage("a", "@storyblok/a", { entries: { "dist/*.mjs": 200 } });

    expect(loadBaseEntries(root, "packages/a", "HEAD")).toEqual({ "dist/*.mjs": 100 });
  });

  it("should return no baselines for a package the ref does not track", () => {
    writePackage("a", "@storyblok/a", { entries: { "dist/*.mjs": 100 } });
    git("add", ".");
    git("commit", "-qm", "base");

    expect(loadBaseEntries(root, "packages/b", "HEAD")).toEqual({});
  });
});

describe("toMarkdown", () => {
  const result = (entries: Array<{ pattern: string; size: number; base: number | undefined }>) => ({
    name: "@storyblok/a",
    dir: "packages/a",
    thresholds: { warn: 5, error: 10 },
    entries: entries.map((entry) => ({
      ...entry,
      files: [],
      baseline: entry.base ?? entry.size,
      change: 0,
      status: "ok" as const,
    })),
  });

  it("should list the entries that changed against the base above the full table", () => {
    const markdown = toMarkdown(
      [
        result([
          { pattern: "dist/*.mjs", size: 1100, base: 1000 },
          { pattern: "dist/*.umd.js", size: 500, base: 500 },
        ]),
      ],
      "main",
    );
    const [changed, all] = markdown.split("<details>");

    expect(markdown.startsWith("<!-- monoblok-bundle-size -->")).toBe(true);
    expect(changed).toContain("1 of 2 entries changed size compared with `main`");
    expect(changed).toContain(
      "| `@storyblok/a` | `dist/*.mjs` | 1000 B | 1.07 kB | +100 B (+10.0%) | ✅ ok |",
    );
    expect(changed).not.toContain("dist/*.umd.js");
    expect(all).toContain("| `@storyblok/a` | `dist/*.umd.js` | 500 B | 500 B | 0 B | ✅ ok |");
  });

  it("should say so when no package changed size", () => {
    const markdown = toMarkdown(
      [result([{ pattern: "dist/*.mjs", size: 500, base: 500 }])],
      "main",
    );

    expect(markdown).toContain("No package changed size compared with `main`.");
  });

  it("should mark an entry the base does not have as new", () => {
    const markdown = toMarkdown([result([{ pattern: "dist/*.mjs", size: 500, base: undefined }])]);

    expect(markdown).toContain("| `@storyblok/a` | `dist/*.mjs` | – | 500 B | new | ✅ ok |");
  });
});

describe("formatDelta", () => {
  it("should show a shrink in bytes and percent", () => {
    expect(formatDelta(900, 1000)).toBe("-100 B (-10.0%)");
  });
});

describe("formatChange", () => {
  it("should label a change from an empty baseline as new", () => {
    expect(formatChange(Infinity)).toBe("new");
  });
});
