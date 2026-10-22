import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI = fileURLToPath(new URL("./cli.ts", import.meta.url));

const cli = (...args: string[]) =>
  spawnSync("node", [CLI, ...args], { encoding: "utf8", env: { PATH: process.env.PATH } });

describe("verify --from", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "blueprint-sync-cli-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("should refuse a directory without a lockfile instead of staging one", () => {
    writeFileSync(join(dir, "package.json"), "{}");

    const result = cli("verify", "blueprint-core-angular", "--from", dir);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("is not a staged blueprint");
  });

  it("should refuse a directory argument next to --from", () => {
    const result = cli("verify", "blueprint-core-angular", dir, "--from", dir);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage:");
  });

  it("should not apply to stage", () => {
    const result = cli("stage", "blueprint-core-angular", dir, "--from", dir);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage:");
  });
});

describe("input checks", () => {
  it("should name an unknown blueprint without a stack trace or a temp dir", () => {
    const result = cli("verify", "nope");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Unknown blueprint "nope"');
    expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
  });

  it("should print usage for --help", () => {
    const result = cli("--help");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });

  it.each(["verify", "check"])("should exit early without a token on %s", (command) => {
    const result = cli(command, "blueprint-core-vue");

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("STORYBLOK_DELIVERY_API_TOKEN is not set");
  });
});

// `check` runs in the workspace, so what a config's `beforeBuild` writes (the token, in Angular's
// environment files) must be put back even when the build fails.
describe.skipIf(process.platform === "win32")("check", () => {
  it("should restore the files beforeBuild rewrote when the build fails", () => {
    const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
    const files = ["environment.ts", "environment.development.ts"].map((name) =>
      join(repoRoot, "blueprints/blueprint-core-angular/src/environments", name),
    );
    const before = files.map((file) => readFileSync(file, "utf8"));
    const bin = mkdtempSync(join(tmpdir(), "blueprint-sync-bin-"));
    try {
      // `node` and `sh`, but no `npm`: the config's build command cannot start.
      symlinkSync(process.execPath, join(bin, "node"));
      symlinkSync("/bin/sh", join(bin, "sh"));

      const result = spawnSync("node", [CLI, "check", "blueprint-core-angular"], {
        encoding: "utf8",
        env: { PATH: bin, STORYBLOK_DELIVERY_API_TOKEN: "token-that-must-not-stay" },
      });

      // It got as far as the build, after `beforeBuild` had written the token.
      expect(result.stderr).toMatch(/npm.*not found/);
      expect(files.map((file) => readFileSync(file, "utf8"))).toEqual(before);
    } finally {
      rmSync(bin, { recursive: true, force: true });
      files.forEach((file, index) => writeFileSync(file, before[index]));
    }
  });
});
