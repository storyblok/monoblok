import { mkdir, mkdtemp, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "pathe";

// Resolving the package by name needs the real filesystem and the built `dist`,
// not the memfs volume the global setup installs.
vi.unmock("node:fs");
vi.unmock("node:fs/promises");

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

// Config loaders (jiti, ts-node, jest) resolve a user's config file imports with
// require conditions, so `storyblok/config` has to be resolvable that way too.
async function projectWithStoryblokInstalled(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "storyblok-entrypoint-"));
  temporaryDirectories.push(cwd);
  await mkdir(join(cwd, "node_modules"));
  await symlink(packageRoot, join(cwd, "node_modules", "storyblok"), "dir");

  return cwd;
}

describe("storyblok/config", () => {
  it("should expose defineConfig to a require-based consumer", async () => {
    const cwd = await projectWithStoryblokInstalled();
    const require = createRequire(join(cwd, "storyblok.config.js"));

    const { defineConfig } = require("storyblok/config");

    expect(defineConfig({ space: "12345" })).toEqual({ space: "12345" });
  });
});
