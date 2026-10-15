import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
    mkdirSync(join(targetDir, ".git"));
    writeFileSync(join(targetDir, "package-lock.json"), "{}");

    stage(repoRoot, "app", targetDir, []);

    expect(existsSync(join(targetDir, ".git"))).toBe(true);
    expect(existsSync(join(targetDir, "package-lock.json"))).toBe(false);
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

  it("should fail when AGENTS.md mentions a script package.json lacks", () => {
    write("blueprints/app/AGENTS.md", "Run `npm run nope`.\n");

    expect(() => stage(repoRoot, "app", targetDir, [])).toThrow(/nope/);
  });

  it("should reject an unknown blueprint", () => {
    expect(() => stage(repoRoot, "nope", targetDir, [])).toThrow(/Unknown blueprint "nope"/);
  });
});
