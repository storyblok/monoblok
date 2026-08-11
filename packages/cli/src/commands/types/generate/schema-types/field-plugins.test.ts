import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SCHEMA_ENTRY_PATH, SCHEMA_ENTRY_RELATIVE_PATH } from "../../../schema/constants";
import { resolveFieldPluginsSource } from "./field-plugins";

// This module resolves a real TypeScript file from disk via jiti, so it needs the
// real filesystem rather than the memfs mock the global test setup installs.
vi.unmock("node:fs");
vi.unmock("node:fs/promises");

let cwd: string;

const SCHEMA_EXPORT = `
export const schema = {
  blocks: {},
  fieldPlugins: { colorPicker: { fieldType: 'storyblok-colorpicker', value: {} } },
};
`;

const RECORD_EXPORT = `
export const fieldPlugins = { colorPicker: { fieldType: 'storyblok-colorpicker', value: {} } };
`;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "sb-field-plugins-"));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe("resolveFieldPluginsSource", () => {
  it("returns none when neither an override nor the convention file exists", async () => {
    expect(await resolveFieldPluginsSource({ cwd })).toEqual({
      kind: "none",
      reason: "missing",
      searchedPath: join(cwd, DEFAULT_SCHEMA_ENTRY_PATH),
    });
  });

  it("detects a defineSchema result at the convention path", async () => {
    const target = join(cwd, DEFAULT_SCHEMA_ENTRY_PATH);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, SCHEMA_EXPORT, "utf8");

    const result = await resolveFieldPluginsSource({ cwd });

    expect(result).toEqual({
      kind: "schema",
      modulePath: target,
      fieldTypes: ["storyblok-colorpicker"],
    });
  });

  it("detects a bare fieldPlugins record via an explicit override", async () => {
    const target = join(cwd, "plugins.ts");
    await writeFile(target, RECORD_EXPORT, "utf8");

    const result = await resolveFieldPluginsSource({ cwd, override: "plugins.ts" });

    expect(result).toEqual({
      kind: "record",
      modulePath: target,
      fieldTypes: ["storyblok-colorpicker"],
    });
  });

  it("throws when an explicit override does not exist", async () => {
    await expect(resolveFieldPluginsSource({ cwd, override: "missing.ts" })).rejects.toThrow(
      /not found/,
    );
  });

  it("throws when an explicit override exports neither supported shape", async () => {
    const target = join(cwd, "plugins.ts");
    await writeFile(target, "export const nope = 1;", "utf8");

    await expect(resolveFieldPluginsSource({ cwd, override: "plugins.ts" })).rejects.toThrow(
      /fieldPlugins/,
    );
  });

  it("resolves the convention path under a custom --path", async () => {
    const target = join(cwd, "config", SCHEMA_ENTRY_RELATIVE_PATH);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, SCHEMA_EXPORT, "utf8");

    const result = await resolveFieldPluginsSource({ cwd, path: "config" });

    expect(result).toEqual({
      kind: "schema",
      modulePath: target,
      fieldTypes: ["storyblok-colorpicker"],
    });
  });

  it("does not look under the default base path when --path is set", async () => {
    const defaultTarget = join(cwd, DEFAULT_SCHEMA_ENTRY_PATH);
    await mkdir(join(defaultTarget, ".."), { recursive: true });
    await writeFile(defaultTarget, SCHEMA_EXPORT, "utf8");

    expect(await resolveFieldPluginsSource({ cwd, path: "config" })).toEqual({
      kind: "none",
      reason: "missing",
      searchedPath: join(cwd, "config", SCHEMA_ENTRY_RELATIVE_PATH),
    });
  });

  it("names a near-miss export in the error for an explicit override", async () => {
    const target = join(cwd, "plugins.ts");
    await writeFile(
      target,
      SCHEMA_EXPORT.replace("export const schema", "export const mySchema"),
      "utf8",
    );

    await expect(resolveFieldPluginsSource({ cwd, override: "plugins.ts" })).rejects.toThrow(
      /`mySchema`/,
    );
  });

  it("names a near-miss bare record too", async () => {
    const target = join(cwd, "plugins.ts");
    await writeFile(
      target,
      RECORD_EXPORT.replace("export const fieldPlugins", "export const myPlugins"),
      "utf8",
    );

    await expect(resolveFieldPluginsSource({ cwd, override: "plugins.ts" })).rejects.toThrow(
      /`myPlugins`/,
    );
  });

  // The distinction drives the advice: `missing` means write a module here,
  // `unusable` means rename an export in the module already here. `schema init`
  // writes exactly this shape, so it is the case users hit first.
  it("returns none with reason unusable when the convention file exists but exports neither shape", async () => {
    const target = join(cwd, DEFAULT_SCHEMA_ENTRY_PATH);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(target, "export const schema = { blocks: {} };", "utf8");

    expect(await resolveFieldPluginsSource({ cwd })).toEqual({
      kind: "none",
      reason: "unusable",
      searchedPath: join(cwd, DEFAULT_SCHEMA_ENTRY_PATH),
    });
  });

  it("carries a near-miss export name from the convention path", async () => {
    const target = join(cwd, DEFAULT_SCHEMA_ENTRY_PATH);
    await mkdir(join(target, ".."), { recursive: true });
    await writeFile(
      target,
      RECORD_EXPORT.replace("export const fieldPlugins", "export const myPlugins"),
      "utf8",
    );

    expect(await resolveFieldPluginsSource({ cwd })).toEqual({
      kind: "none",
      reason: "unusable",
      searchedPath: target,
      nearMissExport: "myPlugins",
    });
  });
});
