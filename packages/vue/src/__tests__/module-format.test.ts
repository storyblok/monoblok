import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

// Regression test for https://github.com/storyblok/monoblok/issues/437:
// "type":"module" caused CJS/UMD dist files to be misidentified as ESM.
// For Vue specifically, the UMD format silently fell through to global
// scope assignment, causing require() to throw on peer dep access.
//
// Runs post-build (nx task graph ensures build → test order).
// Reads export paths from package.json so the test stays correct after
// a rename from .js → .cjs or any future restructure.

const req = createRequire(import.meta.url);
const pkgRoot = resolve(__dirname, "../..");
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));

const cjsEntry = resolve(pkgRoot, pkg.exports["."].require.default);
const esmEntry = resolve(pkgRoot, pkg.exports["."].import.default);

describe("module format: require() (CJS)", () => {
  it("should load without throwing", () => {
    expect(() => req(cjsEntry)).not.toThrow();
  });

  it("should export StoryblokVue plugin", () => {
    const mod = req(cjsEntry);
    expect(mod.StoryblokVue).toBeDefined();
  });

  it("should export useStoryblok as a function", () => {
    const mod = req(cjsEntry);
    expect(typeof mod.useStoryblok).toBe("function");
  });
});

describe("module format: import() (ESM)", () => {
  it("should load without throwing", async () => {
    await expect(import(pathToFileURL(esmEntry).href)).resolves.toBeDefined();
  });

  it("should export StoryblokVue plugin", async () => {
    const mod = await import(pathToFileURL(esmEntry).href);
    expect(mod.StoryblokVue).toBeDefined();
  });
});
