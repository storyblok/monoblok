import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "pathe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashDirectory } from "./fingerprint.ts";

describe("hashDirectory", () => {
  let dir: string;

  function writeFile(file: string, content: string): void {
    const path = resolve(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
  }

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), "openapi-codegen-fingerprint-"));
    writeFile("capi/types.gen.ts", "export type A = string;\nexport type B = number;\n");
    writeFile("types/story.ts", "export type Story = {};\n");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("should ignore line endings", () => {
    const before = hashDirectory(dir);

    writeFile("capi/types.gen.ts", "export type A = string;\r\nexport type B = number;\r\n");

    expect(hashDirectory(dir)).toBe(before);
  });

  it("should change when a file changes", () => {
    const before = hashDirectory(dir);

    writeFile("types/story.ts", "export type Story = { id: number };\n");

    expect(hashDirectory(dir)).not.toBe(before);
  });

  it("should change when a file moves", () => {
    const before = hashDirectory(dir);

    renameSync(resolve(dir, "types/story.ts"), resolve(dir, "types/story-v2.ts"));

    expect(hashDirectory(dir)).not.toBe(before);
  });
});
