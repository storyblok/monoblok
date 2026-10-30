import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "pathe";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveCjsEntry } from "../../../tools/cjs/resolve-cjs-entry.ts";

// Regression test for https://github.com/storyblok/monoblok/issues/437:
// "type":"module" caused CJS/UMD dist files to be misidentified as ESM,
// breaking require() callers (UMD silently returned an empty object {}).
//
// Runs post-build (nx task graph ensures build → test order).
// Reads export paths from package.json so the test stays correct after
// a rename from .js → .cjs or any future restructure.

const req = createRequire(import.meta.url);
const pkgRoot = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));

const cjsEntry = resolveCjsEntry(pkgRoot);
const esmEntry = resolve(pkgRoot, pkg.exports["."].import.default);

describe("module format: require() (CJS)", () => {
  it("should load without throwing", () => {
    expect(() => req(cjsEntry)).not.toThrow();
  });

  it("should export storyblokInit as a function", () => {
    const mod = req(cjsEntry);
    expect(typeof mod.storyblokInit).toBe("function");
  });

  it("should export apiPlugin as a function", () => {
    const mod = req(cjsEntry);
    expect(typeof mod.apiPlugin).toBe("function");
  });

  // Regression test for https://github.com/storyblok/monoblok/issues/891:
  // node-mode interop turned `storyblok-js-client`'s default into the exports object.
  it("should create a client when calling apiPlugin", () => {
    const mod = req(cjsEntry);
    const { storyblokApi } = mod.apiPlugin({ apiOptions: { accessToken: "x" } });
    expect(typeof storyblokApi.get).toBe("function");
  });
});

describe("module format: import() (ESM)", () => {
  it("should load without throwing", async () => {
    await expect(import(pathToFileURL(esmEntry).href)).resolves.toBeDefined();
  });

  it("should export storyblokInit as a function", async () => {
    const mod = await import(pathToFileURL(esmEntry).href);
    expect(typeof mod.storyblokInit).toBe("function");
  });
});
