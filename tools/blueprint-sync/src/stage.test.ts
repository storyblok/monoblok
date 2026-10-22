import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listWorkspacePackages } from "./resolve.ts";
import { composeAgents, missingScripts, stage } from "./stage.ts";

describe("missingScripts", () => {
  const packageJson = JSON.stringify({ scripts: { dev: "vite", build: "vite build" } });

  it("should accept commands for scripts that exist", () => {
    expect(missingScripts("`npm install`, `npm run dev`, `npm run build`", packageJson)).toEqual(
      [],
    );
  });

  it("should report npm run, npm start, and npm test without a matching script", () => {
    expect(missingScripts("`npm run lint`, `npm start`, `npm test`", packageJson)).toEqual([
      "lint",
      "start",
      "test",
    ]);
  });
});

describe("composeAgents", () => {
  it("should append the Storyblok part under its own heading", () => {
    expect(composeAgents("# App\n", "Rules.\n")).toBe(
      "# App\n\n## Storyblok\n\n<!-- synced from storyblok/monoblok; edit in the monorepo -->\n\nRules.\n",
    );
  });
});

describe("stage", () => {
  let repoRoot: string;
  let targetDir: string;
  const write = (path: string, content: string): void => {
    mkdirSync(join(repoRoot, path, ".."), { recursive: true });
    writeFileSync(join(repoRoot, path), content);
  };

  // A minimal monorepo: one blueprint, the shared AGENTS part, and git, which `stage` lists from.
  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "blueprint-sync-repo-"));
    targetDir = mkdtempSync(join(tmpdir(), "blueprint-sync-target-"));
    write("blueprints/AGENTS.storyblok.md", "Rules.\n");
    write("blueprints/app/package.json", '{ "name": "app", "scripts": { "dev": "vite" } }\n');
    write("blueprints/app/AGENTS.md", "Run `npm run dev`.\n");
    write("blueprints/app/.gitignore", ".env\ndist/\n");
    write("blueprints/app/.env.example", "STORYBLOK_DELIVERY_API_TOKEN=\n");
    write("blueprints/app/src/main.js", "");
    execFileSync("git", ["init", "-q"], { cwd: repoRoot });
    execFileSync("git", ["add", "."], { cwd: repoRoot });
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  });

  it("should mirror the blueprint and generate package.json and AGENTS.md", () => {
    write("blueprints/app/src/new.js", "");

    stage(repoRoot, "app", targetDir, []);

    expect(existsSync(join(targetDir, ".env.example"))).toBe(true);
    expect(existsSync(join(targetDir, "src/new.js"))).toBe(true);
    expect(readFileSync(join(targetDir, "AGENTS.md"), "utf8")).toContain("## Storyblok");
  });

  it("should leave out files the blueprint's .gitignore ignores", () => {
    write("blueprints/app/.env", "STORYBLOK_DELIVERY_API_TOKEN=secret\n");
    write("blueprints/app/dist/index.html", "");

    stage(repoRoot, "app", targetDir, []);

    expect(existsSync(join(targetDir, ".env"))).toBe(false);
    expect(existsSync(join(targetDir, "dist"))).toBe(false);
  });

  it("should not ship the nx project config", () => {
    write("blueprints/app/project.json", '{ "tags": ["blueprint"] }\n');
    write(
      "blueprints/app/package.json",
      '{\n\t"name": "app",\n\t"scripts": { "dev": "vite" },\n\t"nx": { "tags": ["blueprint"] }\n}\n',
    );
    write("blueprints/app/src/project.json", "{}\n");

    stage(repoRoot, "app", targetDir, []);

    expect(existsSync(join(targetDir, "project.json"))).toBe(false);
    expect(existsSync(join(targetDir, "src/project.json"))).toBe(true);
    const manifest = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8"));
    expect(manifest).not.toHaveProperty("nx");
    expect(manifest.scripts).toEqual({ dev: "vite" });
  });

  it("should fail when AGENTS.md mentions a script package.json lacks", () => {
    write("blueprints/app/AGENTS.md", "Run `npm run nope`.\n");

    expect(() => stage(repoRoot, "app", targetDir, [])).toThrow(/nope/);
  });

  it("should fail on a tracked file the blueprint's .gitignore ignores", () => {
    write("blueprints/app/dist/index.html", "");
    execFileSync("git", ["add", "-f", "."], { cwd: repoRoot });

    expect(() => stage(repoRoot, "app", targetDir, [])).toThrow(/dist\/index\.html/);
  });

  it("should refuse a target inside the repository", () => {
    expect(() => stage(repoRoot, "app", join(repoRoot, "blueprints/app"), [])).toThrow(
      /inside the repository/,
    );
    expect(() => stage(repoRoot, "app", repoRoot, [])).toThrow(/inside the repository/);
    expect(existsSync(join(repoRoot, "blueprints/app/src/main.js"))).toBe(true);
  });

  it("should refuse a target inside the repository whose name starts with two dots", () => {
    expect(() => stage(repoRoot, "app", join(repoRoot, "..out"), [])).toThrow(
      /inside the repository/,
    );
  });

  it("should refuse a non-empty target, git checkout or not", () => {
    writeFileSync(join(targetDir, ".env.local"), "TOKEN=1\n");

    expect(() => stage(repoRoot, "app", targetDir, [])).toThrow(/not empty/);
    expect(existsSync(join(targetDir, ".env.local"))).toBe(true);

    rmSync(join(targetDir, ".env.local"));
    mkdirSync(join(targetDir, ".git"));
    expect(() => stage(repoRoot, "app", targetDir, [])).toThrow(/not empty/);
    expect(existsSync(join(targetDir, ".git"))).toBe(true);
  });

  it.skipIf(process.platform === "win32")(
    "should refuse the repository through a symlink or another spelling of its path",
    () => {
      const link = join(targetDir, "link");
      symlinkSync(repoRoot, link);
      // The empty directory is the repo's, reached by a path that does not start with its root.
      expect(() => stage(repoRoot, "app", join(link, "blueprints/app/out"), [])).toThrow(
        /inside the repository/,
      );
      expect(() => stage(repoRoot, "app", link, [])).toThrow(/inside the repository/);
      expect(existsSync(join(repoRoot, "blueprints/app/src/main.js"))).toBe(true);
    },
  );

  it("should refuse a blueprint that ships .github", () => {
    write("blueprints/app/.github/workflows/ci.yaml", "");

    expect(() => stage(repoRoot, "app", targetDir, [])).toThrow(/\.github/);
  });

  it("should write nothing when a check fails", () => {
    write("blueprints/app/AGENTS.md", "Run `npm run nope`.\n");

    expect(() => stage(repoRoot, "app", targetDir, [])).toThrow(/nope/);
    expect(readdirSync(targetDir)).toEqual([]);
  });

  it("should stage into a directory that does not exist yet", () => {
    const fresh = join(targetDir, "fresh");

    stage(repoRoot, "app", fresh, []);

    expect(existsSync(join(fresh, "package.json"))).toBe(true);
  });

  it("should reject an unknown blueprint", () => {
    expect(() => stage(repoRoot, "nope", targetDir, [])).toThrow(/Unknown blueprint "nope"/);
  });
});

// ADR-0022: blueprints are nx projects in the workspace, but nothing nx-specific may reach a target.
describe("stage of the real blueprints", () => {
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const blueprints = readdirSync(join(repoRoot, "blueprints"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted();
  const workspace = listWorkspacePackages(repoRoot);

  it.each(blueprints)("should leave no project.json or nx key in %s", (blueprint) => {
    const targetDir = mkdtempSync(join(tmpdir(), "blueprint-sync-real-"));
    try {
      stage(repoRoot, blueprint, targetDir, workspace);

      expect(existsSync(join(targetDir, "project.json"))).toBe(false);
      expect(JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8"))).not.toHaveProperty(
        "nx",
      );
    } finally {
      rmSync(targetDir, { recursive: true, force: true });
    }
  });

  it("should have an nx project.json in the workspace for each", () => {
    for (const blueprint of blueprints) {
      expect(existsSync(join(repoRoot, "blueprints", blueprint, "project.json"))).toBe(true);
    }
  });
});
